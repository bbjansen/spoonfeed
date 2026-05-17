# Dev Container

VS Code Dev Container configuration with Docker Compose services for local development.

## Links

- [Dev Containers Specification](https://containers.dev/)
- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)
- [Dev Container Features](https://containers.dev/features)

## Dependencies

No npm dependencies. Requires Docker Desktop or compatible container runtime.

| Package | Version | Purpose                 |
| ------- | ------- | ----------------------- |
| (none)  | -       | Requires Docker Desktop |

## Usage

1. Open the project in VS Code
2. Install the "Dev Containers" extension
3. Press `Ctrl+Shift+P` and select "Dev Containers: Reopen in Container"
4. The container will build and start with Postgres and Redis

## Generated Files

| File                               | Description                               |
| ---------------------------------- | ----------------------------------------- |
| `.devcontainer/devcontainer.json`  | VS Code dev container configuration       |
| `.devcontainer/docker-compose.yml` | Docker Compose services (Postgres, Redis) |
