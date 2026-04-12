# Quantity Measurement App 

A polished single-page frontend for scientific quantity operations, built with pure HTML, CSS, and Vanilla JavaScript.

This branch is focused on UI, interaction quality, and smooth local demo flow. Backend integration is intentionally deferred, and all flows run with mock data in-browser.

## Overview

Quantity Measurement App provides:

- Sign In and Register flow in the same page
- Remember Me login behavior
- Theme switching (light/dark) with icon toggle
- Interactive operation tabs:
  - Compare
  - Add
  - Subtract
  - Divide
  - Convert
- Animated transitions between operation modes
- Result panel with contextual success/error styles
- Lightweight success popup dialogs for login/register

## Current Scope of This Branch

- Single-page UX only (no multi-page navigation required)
- Mock API behavior via localStorage/sessionStorage
- Real backend calls are disabled in this branch
- Focused on UI quality and interaction design

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript (no framework, no build step)

## Project Structure

- index.html  
  Main single-page app (Auth + Operations)
- style.css  
  Shared design system, theme variables, animations, interactions
- app.js  
  App logic, mock API, auth/session handling, theme, operations workflow

## Key UI Features

### Authentication
- Sign In and Register tabs in one card
- Register supports Name, Email, Password
- Inline form error handling
- Remember Me:
  - Checked: persistent login (localStorage)
  - Unchecked: session-only login (sessionStorage)

### Operations Workspace
- Inline operation tab switch with animations
- Dynamic unit options based on measurement type
- Convert mode automatically adapts second value behavior
- Animated result reveal after calculation
- Styled feedback using toast notifications

### Theme System
- Icon-only theme toggle button
- Light/Dark mode persisted in localStorage
- Smooth visual transitions and accessible labels

### Micro-interactions
- Button hover, active, and focus-visible states
- Tab underline and panel transition animations
- Lightweight popup animation for success dialogs

## Mock Data and UI-Only Behavior

This branch uses an internal mock layer in JavaScript:

- Auth endpoints are simulated
- Quantity operations are calculated client-side
- Seed includes one default admin user
- New registered users are stored locally

## Demo Credentials

Use this seeded account to sign in quickly:

- Email: admin@quantimeasure.app
- Password: Admin@123

Or create a new account from Register.

## How to Run

1. Start your Spring Boot app (optional for static hosting), or open with Live Server.
2. Open index.html
3. Use Sign In or Register
4. Start performing operations in the same page

## Notes

- This branch intentionally prioritizes UI and frontend behavior.
- Backend integration can be enabled later by switching API mode in JavaScript and wiring real endpoints.
- Removed legacy/unused pages and files to keep this branch focused and clean.

## Future Integration Checklist

- Enable real API mode
- Map auth and quantity endpoints to backend
- Replace mock storage with JWT + server responses
- Add backend validation messages to UI
- Add test coverage for operation forms and auth states
