# Development Workflow

## Current Phase

Current phase: frontend initial development environment.

Included in this phase:

- Vite React TypeScript entry point
- Environment-based backend API URL loading
- Backend health check integration
- Structured frontend console logging
- Vitest and React Testing Library minimum test
- Frontend-owned Docker Compose entry point for local MSA execution
- Initial design guidance in `docs/design.md`
- README and agent guidance aligned to the current repository structure

## Local Commands

```bash
npm install
cp .env.example .env
npm run dev
```

```bash
npm run lint
npm test
npm run build
```

```bash
docker compose up --build
```

## Phase Tracking

Keep this file as the lightweight development phase log while the project is small. Split phase planning into `docs/development-phases.md` only when multiple active phases or owners need separate tracking.

## Documentation Rules

- Architecture changes belong in `docs/frontend-architecture.md`.
- UI direction and screen responsibility belong in `docs/design.md`.
- Repeated setup/runtime failures belong in `docs/troubleshooting.md`.
- Durable architectural decisions belong in `docs/adr/NNNN-title.md`.
- README should keep only the entry commands and links.
