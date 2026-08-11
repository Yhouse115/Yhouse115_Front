# WhyHouse Front

WhyHouse Front는 아이 관점의 아파트 생활 인프라와 보행 안전 인사이트를 보여주는 React 기반 프론트엔드입니다. 백엔드 API는 별도 레포 `../WhyHouse_Back`이 소유하며, 로컬 MSA 실행은 백엔드의 Docker Compose에서 함께 조정합니다.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend: http://localhost:3000

## Test

```bash
npm run lint
npm test
npm run build
```

## Docker Compose

프론트 레포에서 전체 로컬 스택 실행:

```bash
cp .env.example .env
docker compose up --build
```

백엔드 레포의 기존 MSA compose로 실행:

```bash
cd ../WhyHouse_Back
cp .env.example .env
docker compose --profile msa up --build
```

## Documents

- [Frontend Architecture](docs/frontend-architecture.md)
- [Design](docs/design.md)
- [Development Workflow](docs/development-workflow.md)
- [Troubleshooting](docs/troubleshooting.md)
