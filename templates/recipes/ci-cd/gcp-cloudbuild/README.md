# GCP Cloud Build

CI/CD pipeline configuration for Google Cloud Build.

## Documentation

- [Cloud Build overview](https://cloud.google.com/build/docs)
- [Build configuration file schema](https://cloud.google.com/build/docs/build-config-file-schema)
- [Substitution variables](https://cloud.google.com/build/docs/configuring-builds/substitute-variable-values)

## Generated Files

| File              | Description                        |
| ----------------- | ---------------------------------- |
| `cloudbuild.yaml` | Cloud Build pipeline configuration |

## Pipeline Stages

1. **Install** -- install pnpm globally and run `pnpm install --frozen-lockfile`
2. **Lint** -- run ESLint via `pnpm lint`
3. **Type check** -- `pnpm exec tsc --noEmit`
4. **Unit tests** -- `pnpm test:unit`
5. **Build** -- compile to `dist/`
6. **Security audit** -- `pnpm audit --audit-level=high` (non-blocking)
7. **Docker build** -- build the container image
8. **Docker push** -- push to Artifact Registry

## Substitution Variables

| Variable      | Default        | Description                               |
| ------------- | -------------- | ----------------------------------------- |
| `_REGION`     | `europe-west1` | GCP region for Artifact Registry          |
| `_REPOSITORY` | `app`          | Artifact Registry repository name         |
| `_IMAGE`      | `api`          | Container image name                      |
| `PROJECT_ID`  | _(built-in)_   | GCP project ID (provided automatically)   |
| `SHORT_SHA`   | _(built-in)_   | Short commit SHA (provided automatically) |

## Usage

### Connecting a repository

1. Go to **Cloud Build > Triggers** in the Google Cloud console.
2. Connect your GitHub or GitLab repository via the **Cloud Build GitHub App** or **GitLab host connection**.
3. Authorize access to the target repository.

### Creating a trigger

1. Click **Create Trigger**.
2. Set the event (e.g. push to `main`, pull request).
3. Under **Configuration**, select **Cloud Build configuration file** and point to `cloudbuild.yaml`.
4. Override substitution variables if needed (region, repository, image name).
5. Save and run the trigger manually to verify the pipeline.

### Prerequisites

- Enable the **Cloud Build API** and **Artifact Registry API** in your GCP project.
- Create an Artifact Registry Docker repository:
  ```bash
  gcloud artifacts repositories create app \
    --repository-format=docker \
    --location=europe-west1 \
    --description="Application container images"
  ```
- Grant the Cloud Build service account permission to push to Artifact Registry (the `roles/artifactregistry.writer` role).
