# Troubleshooting

## Backend Health Check Fails

Symptom: the frontend shows `Backend disconnected`.

Checks:

```bash
curl http://localhost:8000/health
```

If the backend is not running, start it from the backend repository:

```bash
cd ../WhyHouse_Back
docker compose up --build backend
```

If the backend uses a different port, update `.env` in this repository:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Docker Compose Frontend Port

The frontend is configured to serve Vite on port `3000` so it matches `../WhyHouse_Back/docker-compose.yml`. If the port is occupied, change `FRONTEND_PORT` in the backend `.env` and run the stack again.
