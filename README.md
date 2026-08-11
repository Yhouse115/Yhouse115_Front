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
VITE_NAVER_MAPS_DEFAULT_STYLE_ID=
VITE_NAVER_MAPS_TRANSIT_STYLE_ID=
VITE_NAVER_MAPS_SOFT_STYLE_ID=
VITE_NAVER_MAPS_NO_TRANSIT_STYLE_ID=
```

네이버 클라우드 콘솔의 Maps Application 설정에서 `Dynamic Map`이 활성화되어 있어야 하고, Web 서비스 URL에는 로컬 확인용으로 `http://localhost:3000`과 `http://127.0.0.1:3000`을 등록하세요.

기본 지도 템플릿은 네이버 기본 지도입니다. 운영 기본값은 이 지도 위에 올리는 지하철역/기준 위치 표시와 색상 설정입니다. 별도의 커스텀 지도 색상이 필요할 때만 Naver Maps Style Editor에서 발행한 Metadata ID를 `VITE_NAVER_MAPS_DEFAULT_STYLE_ID`, `VITE_NAVER_MAPS_TRANSIT_STYLE_ID`, `VITE_NAVER_MAPS_SOFT_STYLE_ID`에 설정하세요.

`지하철역 표시`를 끄면 프론트에서 올린 지하철역 오버레이 마커는 즉시 숨겨집니다. 네이버 기본 지도 타일에 포함된 지하철역 POI까지 숨기려면 Style Editor에서 해당 POI를 숨긴 스타일을 발행하고 `VITE_NAVER_MAPS_NO_TRANSIT_STYLE_ID`에 설정해야 합니다.

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
