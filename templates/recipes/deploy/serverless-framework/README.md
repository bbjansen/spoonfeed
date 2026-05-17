# Serverless Framework

Deploy the NestJS application as an AWS Lambda function using Serverless Framework.

## Links

- [Serverless Framework Docs](https://www.serverless.com/framework/docs/)
- [serverless-offline Plugin](https://www.npmjs.com/package/serverless-offline)

## Dependencies

| Package              | Version | Purpose                |
| -------------------- | ------- | ---------------------- |
| `serverless`         | CLI     | Deployment framework   |
| `serverless-offline` | dev     | Local Lambda emulation |

## Usage

```bash
# Install Serverless CLI
npm install -g serverless

# Local development
pnpm add -D -E serverless-offline
serverless offline

# Deploy to AWS
serverless deploy --stage dev
serverless deploy --stage production

# Remove deployment
serverless remove --stage dev
```

## Generated Files

| File             | Description                        |
| ---------------- | ---------------------------------- |
| `serverless.yml` | Serverless Framework configuration |
