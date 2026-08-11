# Frontend Architecture

## Runtime

- Language: TypeScript
- UI runtime: React
- Build tool: Vite
- Package manager: npm
- Node version: 22, tracked in `.nvmrc`
- Local MSA runtime: `../WhyHouse_Back/docker-compose.yml`

## Repository Responsibility

This repository owns browser UI, presentation state, frontend configuration, and backend API consumption. It does not own backend calculations, persistence, route scoring, safety scoring, or external dataset normalization.

## Folder Responsibilities

```text
src/
  App.tsx                 Application shell and first mounted view
  main.tsx                React DOM entry point
  config/                 Browser-safe VITE_* configuration loading
  components/             Reusable UI components
  features/apartments/    Apartment domain screens, state, and adapters
  services/               API clients, integration boundaries, shared logging
  styles/                 Shared global styles
```

`src/assets/` should be added only when real static assets are introduced. `tests/resources/` should be added only when reusable fixture files are needed.

## Backend Boundary

The backend runs on `http://localhost:8000` by default and exposes `/health` and `/api/v1/health`. The frontend reads `VITE_API_BASE_URL` and uses `/health` for the initial integration check.

When the full local stack is needed, run Docker Compose from `../WhyHouse_Back`:

```bash
docker compose --profile msa up --build
```

The backend compose file mounts this repository as the `frontend` service and runs `npm run dev`, which serves Vite on port `3000`.

## Future ADRs

Create ADRs under `docs/adr/NNNN-title.md` only for durable choices with meaningful alternatives, consequences, and migration cost.
