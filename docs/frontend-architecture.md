# Frontend Architecture

## Runtime

- Language: TypeScript
- UI runtime: React
- Build tool: Vite
- Package manager: npm
- Node version: 22, tracked in `.nvmrc`
- Local MSA runtime: `docker-compose.yml` or `../WhyHouse_Back/docker-compose.yml`

## Repository Responsibility

This repository owns browser UI, presentation state, frontend configuration, and backend API consumption. It does not own backend calculations, persistence, route scoring, safety scoring, or external dataset normalization.

## Folder Responsibilities

```text
src/
  App.tsx                 Application shell and first mounted view
  main.tsx                React DOM entry point
  config/                 Browser-safe VITE_* configuration loading
  assets/                 Committed static assets and asset guidance
  components/             Reusable UI components
  features/apartments/    Apartment domain screens, state, and adapters
  services/               API clients, integration boundaries, shared logging
  styles/                 Shared global styles
```

`tests/resources/` should be added only when reusable fixture files are needed.

## Backend Boundary

The backend runs on `http://localhost:8000` by default and exposes `/health` and `/api/v1/health`. The frontend reads `VITE_API_BASE_URL` and uses `/health` for the initial integration check.

When the full local stack is needed from this frontend repository:

```bash
docker compose up --build
```

The frontend compose file builds the backend from `../WhyHouse_Back` and serves Vite on port `3000`.

The backend repository also keeps its own MSA compose entry point:

```bash
docker compose --profile msa up --build
```

Run that command from `../WhyHouse_Back`.

## Future ADRs

Create ADRs under `docs/adr/NNNN-title.md` only for durable choices with meaningful alternatives, consequences, and migration cost.
