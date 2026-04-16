# Quantity Measurement App Frontend

Angular frontend for the Quantity Measurement application, integrated with a Spring Boot backend.

This document captures:
- what was implemented in this branch,
- how integration was done,
- backend/frontend contract alignment,
- Google OAuth flow setup,
- known issues and fixes,
- run and verification steps.

## 1. What Was Completed In This Branch

### Frontend Migration and App Setup
- Migrated UI to Angular standalone app architecture.
- Added Angular workspace/build configuration for this frontend repo.
- Wired component-driven auth, operations, history, users, toasts, and theme behavior.

### Backend Integration
- Replaced local/mock behavior with real HTTP integration to Spring Boot backend.
- Implemented API service layer for:
  - auth (`/auth/register`, `/auth/login`),
  - quantity operations (`/api/v1/quantities/*`),
  - history endpoints,
  - user endpoints (`/users/me`, `/users/all`).
- Added JWT persistence in browser storage and authenticated request headers.

### Local Development Proxy and CORS-safe Dev Flow
- Added dev proxy (`proxy.conf.json`) to route `/backend/*` -> backend server.
- Updated startup command to always run Angular with proxy.
- Moved API base URL to environment config for easier switching.

### Google OAuth Frontend Flow
- Wired `Continue with Google` in auth UI.
- Added callback token handling (query/hash token parsing).
- Added popup-based OAuth handling with `postMessage` relay to main window.
- Added fallback/session bootstrap path for cookie/session-style responses.

### Contract and Unit Fixes
- Updated frontend length unit to `YARDS` to match backend.
- Identified backend-side conversion issues where service used strict `Enum.valueOf(...)` and did not use safe enum parsing.
- Identified backend OAuth success behavior returning JSON token instead of redirecting to frontend (and provided fix pattern).

## 2. Key Frontend Files Added/Updated

- `angular.json`
- `package.json`
- `proxy.conf.json`
- `web-src/environments/environment.ts`
- `web-src/environments/environment.prod.ts`
- `web-src/app/backend-api.service.ts`
- `web-src/app/app.ts`
- `web-src/app/app.html`
- `web-src/app/app.config.ts`

## 3. Integration Approach (How It Was Done)

### Step A: API Contract-First Integration
Backend OpenAPI (`/api-docs`) was used to align:
- request/response DTO shapes,
- auth response token structure,
- measurement operation endpoints,
- role-protected endpoints (`/users/all` admin only).

### Step B: Service Layer in Angular
A dedicated Angular service was introduced (`backend-api.service.ts`) to:
- centralize backend calls,
- normalize error messages,
- attach JWT bearer tokens,
- support cookie credentials when needed (`withCredentials`).

### Step C: App Component Refactor
`app.ts` was refactored from mock/local storage data model to backend-driven async flow:
- login/register via HTTP,
- operations via backend compute endpoints,
- history and users loaded from backend,
- role-aware users view,
- robust toast/popup feedback.

### Step D: OAuth Flow Stabilization
- Google button now triggers real OAuth start.
- OAuth callback token parsing supported in URL query/hash.
- Popup flow captures callback and relays session to opener tab using `postMessage`.
- Prevented hard logout on transient bootstrap/profile fetch failures.

### Step E: Dev Routing/Proxy
- Frontend calls `/backend/...` in dev mode.
- Proxy rewrites `/backend` prefix and forwards to backend host.
- Avoids browser CORS pain during local development.

## 4. Run Instructions

## Prerequisites
- Node.js + npm
- Java + Maven for backend (in separate backend repo)
- Backend expected on `http://localhost:8080`

## Start Frontend
```bash
npm install
npm start
```

Default frontend URL:
- `http://localhost:4200`

## Build Frontend
```bash
npm run build
```

## Start Backend
Run backend from backend repository (example):
```bash
mvn clean spring-boot:run
```

## 5. Environment and Proxy

### Environment (frontend)
`web-src/environments/environment.ts`
- `apiBaseUrl: '/backend'` (dev)

### Proxy
`proxy.conf.json`
- rewrites `/backend/*` -> `http://localhost:8080/*`

### Important
If frontend is started with plain `ng serve` (without proxy), requests like `/backend/auth/register` fail with:
- `Cannot POST /backend/auth/register`

Always start frontend via:
```bash
npm start
```

## 6. Google OAuth Requirements

For Google OAuth to complete and auto-login frontend:

1. Backend OAuth success handler should redirect to frontend with token/query params, for example:
- `http://localhost:4200/?token=...&type=Bearer&email=...`

2. Google Cloud Console OAuth client should include redirect URIs:
- `http://localhost:8080/login/oauth2/code/google`
- `http://127.0.0.1:8080/login/oauth2/code/google` (if backend resolves host this way)

3. Authorized JavaScript origins typically include:
- `http://localhost:8080`
- `http://localhost:4200`
- `http://127.0.0.1:4200` (optional but useful in mixed-host local setups)

## 7. Backend Issues Identified During Integration

### OAuth Success Handler Behavior
Observed backend behavior:
- successful OAuth callback returned JSON token body on backend URL instead of redirecting frontend.

Impact:
- user sees token page, main frontend tab may remain unauthenticated.

Fix:
- update backend `OAuth2SuccessHandler` to `sendRedirect(...)` with token query params.

### Volume Conversion Enum Mismatch
Observed behavior:
- conversion errors like `No enum constant ... VolumeUnit.MILLILITER`.

Root cause:
- backend service resolved units with strict `Enum.valueOf(unitName)`.
- enum had parser/alias handling, but service path bypassed it.

Fix:
- in service, use enum `fromUnitName(...)` style resolution.
- keep enum and validator vocabulary consistent.

### Weight Unit Vocabulary Drift
Frontend uses `TONNE`; backend had `POUND` only in provided snippet.

Fix:
- align backend and frontend unit sets (or add alias mapping).

## 8. Verification Checklist

### Auth
- Register with a new email: success response and session established.
- Sign in with existing user: lands on main app.

### Google OAuth
- Click `Continue with Google`.
- Complete Google login.
- App returns to frontend and user becomes logged in.

### Operations
- Convert `100 FEET -> YARDS`: should succeed.
- Convert `1000 MILLILITER -> LITER`: should succeed after backend volume fix.
- Add/Subtract/Divide: should create history entries.

### Users and Roles
- `/users/me` loads current user.
- `/users/all` visible/usable only for admin role.

### History
- Operation history renders rows.
- Error rows are tagged correctly.

## 9. Troubleshooting Guide

### Problem: `Cannot POST /backend/auth/register`
Cause:
- frontend server started without proxy.

Fix:
- stop old server,
- run `npm start` from this repo.

### Problem: `Http failure response ... 0 Unknown Error`
Likely causes:
- backend not running,
- CORS/preflight issue when bypassing proxy,
- stale frontend server instance.

Fix:
- ensure backend is running on 8080,
- run frontend with proxy-enabled script,
- hard refresh browser.

### Problem: Google `redirect_uri_mismatch`
Cause:
- mismatch between generated backend callback URL and Google Cloud registered redirect URI.

Fix:
- register exact callback URL(s) in Google Cloud Console,
- restart backend.

### Problem: redirected to same auth page after Google
Cause:
- OAuth completes in popup/backend but session not applied to opener tab.

Fix:
- use current frontend code (popup + `postMessage` relay),
- hard refresh and retry,
- ensure backend success handler sends redirect with token params.

## 10. Security Notes

- Do not commit real OAuth client secrets in public repos/chat.
- Rotate exposed Google OAuth client secret immediately.
- Prefer environment variables for backend secrets.

## 11. Final Notes

This branch now contains the Angular frontend integration layer and flow hardening for real backend usage.

If backend enum/parser and OAuth success redirect changes are applied as documented, the full user journey (register/login/google + operations/history/users) works end-to-end for local development.
