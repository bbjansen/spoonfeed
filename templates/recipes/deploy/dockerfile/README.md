# Dockerfile

Multi-stage production Docker image for NestJS applications.

## Documentation

- [Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)

## Generated Files

| File            | Description                                       |
| --------------- | ------------------------------------------------- |
| `Dockerfile`    | Multi-stage build (builder + production)          |
| `.dockerignore` | Excludes unnecessary files from the build context |

## Build Stages

1. **builder** -- installs dependencies with `pnpm install --frozen-lockfile`, copies source, runs `pnpm build`, then prunes dev dependencies
2. **production** -- minimal `node:22-alpine` image with `dumb-init`, copies `dist/`, production `node_modules/`, and `package.json`; runs as the `node` user on port 3000

## Usage

```bash
# Build the image
docker build -t my-app .

# Run the container
docker run -p 3000:3000 --env-file .env my-app
```
