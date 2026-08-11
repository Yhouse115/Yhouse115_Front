# Design

## Product Direction

WhyHouse Front should present apartment-centered living infrastructure and child safety insights clearly enough for users to compare locations without understanding backend calculations.

## Screen Responsibility

- Show backend connectivity and runtime status during the initial setup phase.
- Keep future apartment search, apartment detail, nearby infrastructure, and safety insight UI under `src/features/apartments/`.
- Keep reusable controls and display components under `src/components/`.
- Keep API calls and response mapping outside components under `src/services/`.

## Initial UI Principles

- Use a quiet, information-focused interface suitable for repeated comparison work.
- Prioritize scanability, readable Korean copy, and clear status states.
- Avoid decorative layouts that make apartment and safety data harder to inspect.
- Keep first-screen UI functional; do not replace the app with a marketing landing page.

## State And Data Boundaries

- The frontend owns view state, loading/error states, filters, selected apartment state, and API request state.
- The backend owns scoring, distance/radius calculations, persistence, and normalized API contracts.
- Browser-exposed configuration must come from `VITE_*` variables through `src/config/env.ts`.

## Future Design Artifacts

Add wireframes, interaction notes, and component states to this file when a real screen is implemented. Split into separate files only after the design surface becomes too large for this document.
