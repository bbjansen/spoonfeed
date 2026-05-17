# Docker Compose Dev

One-command local development environment with hot reload and debugging support.

## Quick Start

```bash
docker compose -f docker-compose.dev.yml up
```

This starts all services:

| Service    | URL / Port              | Description                        |
| ---------- | ----------------------- | ---------------------------------- |
| `app`      | `http://localhost:3000` | NestJS application with hot reload |
| `postgres` | `localhost:5432`        | PostgreSQL 16 database             |
| `redis`    | `localhost:6379`        | Redis 7 cache / message broker     |
| `adminer`  | `http://localhost:8080` | Database management UI             |

## Debugging

The debug port `9229` is exposed for the Node.js inspector. Attach your IDE debugger to `localhost:9229`.

### VS Code launch.json

```json
{
  "type": "node",
  "request": "attach",
  "name": "Docker: Attach",
  "port": 9229,
  "remoteRoot": "/app",
  "localRoot": "${workspaceFolder}"
}
```

## Hot Reload

Source code is mounted as a volume (`./:/app`), so file changes on the host are reflected inside the container immediately. The `node_modules` directory is kept in an anonymous volume to avoid overwriting container dependencies.

## Environment Variables

The app service reads from `.env` in the project root. Database credentials default to:

| Variable      | Default      |
| ------------- | ------------ |
| `DB_USERNAME` | `dev`        |
| `DB_PASSWORD` | `dev`        |
| `DB_NAME`     | project name |
| `PORT`        | `3000`       |

## Generated Files

| File                     | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `docker-compose.dev.yml` | Compose file for the local dev environment      |
| `Dockerfile.dev`         | Development Dockerfile with pnpm and hot reload |
