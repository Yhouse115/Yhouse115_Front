# WhyHouse Front

WhyHouse Front는 아이 관점의 아파트 생활 인프라와 보행 안전 인사이트를 보여주는 React 기반 프론트엔드입니다. 백엔드 API는 별도 레포 `../WhyHouse_Back`이 소유하며, 프론트 레포의 Docker Compose로 로컬 DB, 백엔드, 프론트 서버를 함께 실행할 수 있습니다.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend: http://localhost:3000

프론트에서 네이버 지도를 직접 렌더링하려면 `.env`에 브라우저용 Client ID를 설정해야 합니다.

```bash
VITE_NAVER_MAPS_CLIENT_ID=your-naver-maps-client-id
```

네이버 클라우드 콘솔의 Maps Application 설정에서 `Dynamic Map`이 활성화되어 있어야 하고, Web 서비스 URL에는 로컬 확인용으로 `http://localhost:3000`과 `http://127.0.0.1:3000`을 등록하세요.

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
docker compose up -d --build
```

실행되는 서비스:

- `whyhouse-database`: local PostGIS/Postgres
- `whyhouse-backend`: FastAPI backend
- `whyhouse-frontend`: Vite frontend

종료:

```bash
docker compose down
```

## Documents

- [Frontend Architecture](docs/frontend-architecture.md)
- [Design](docs/design.md)
- [Development Workflow](docs/development-workflow.md)
- [Troubleshooting](docs/troubleshooting.md)
