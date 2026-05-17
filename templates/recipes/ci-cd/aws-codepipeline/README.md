# AWS CodePipeline

Build specification for AWS CodeBuild, typically used with AWS CodePipeline.

## Documentation

- [AWS CodePipeline](https://docs.aws.amazon.com/codepipeline/)
- [AWS CodeBuild](https://docs.aws.amazon.com/codebuild/)
- [Build spec reference](https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html)

## Generated Files

| File            | Description                       |
| --------------- | --------------------------------- |
| `buildspec.yml` | AWS CodeBuild build specification |

## Build Phases

1. **install** -- set up Node.js runtime, install pnpm, install frozen lockfile
2. **pre_build** -- lint, type-check, unit tests, integration tests
3. **build** -- compile to `dist/`
4. **post_build** -- security audit (non-blocking)

## Artifacts

The build produces `dist/`, `package.json`, `pnpm-lock.yaml`, and `node_modules/` as artifacts for downstream deploy actions.

## Caching

`node_modules/` and `.pnpm-store/` are cached between builds to speed up installs.
