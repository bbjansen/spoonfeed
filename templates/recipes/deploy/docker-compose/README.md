# Docker Compose

Full-stack Docker Compose setup with the NestJS application, Postgres, and Redis.

## Documentation

- [Docker Compose](https://docs.docker.com/compose/)
- [Compose file reference](https://docs.docker.com/compose/compose-file/)

## Generated Files

| File                 | Description                                      |
| -------------------- | ------------------------------------------------ |
| `docker-compose.yml` | Service definitions for app, Postgres, and Redis |

## Services

| Service    | Image                 | Port | Description                           |
| ---------- | --------------------- | ---- | ------------------------------------- |
| `app`      | Built from Dockerfile | 3000 | NestJS application                    |
| `postgres` | `postgres:16-alpine`  | 5432 | PostgreSQL database with health check |
| `redis`    | `redis:7-alpine`      | 6379 | Redis cache with health check         |

## Usage

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```
