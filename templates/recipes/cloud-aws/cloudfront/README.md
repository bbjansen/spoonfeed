# AWS CloudFront

AWS CloudFront CDN integration with signed URLs for NestJS.

## Documentation

- [AWS CloudFront Developer Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/)
- [CloudFront Signed URLs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html)
- [@aws-sdk/client-cloudfront on npm](https://www.npmjs.com/package/@aws-sdk/client-cloudfront)

## Dependencies

| Package                      | Version   | Purpose                      |
| ---------------------------- | --------- | ---------------------------- |
| `@aws-sdk/client-cloudfront` | `3.712.0` | AWS SDK v3 CloudFront client |

## Environment Variables

| Variable                     | Default     | Description                    |
| ---------------------------- | ----------- | ------------------------------ |
| `AWS_REGION`                 | `eu-west-1` | AWS region                     |
| `CLOUDFRONT_DISTRIBUTION_ID` | —           | CloudFront distribution ID     |
| `CLOUDFRONT_DOMAIN`          | —           | CloudFront distribution domain |
| `CLOUDFRONT_KEY_PAIR_ID`     | —           | Key pair ID for signed URLs    |

## Usage

```typescript
import { CloudFrontService } from '@/aws/cloudfront.service';

@Injectable()
export class AssetService {
  constructor(private readonly cdn: CloudFrontService) {}

  getSignedUrl(objectKey: string, expiresInSeconds: number): string {
    return this.cdn.createSignedUrl({
      url: `https://${this.configService.get('CLOUDFRONT_DOMAIN')}/${objectKey}`,
      keyPairId: this.configService.get('CLOUDFRONT_KEY_PAIR_ID'),
      dateLessThan: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    });
  }

  async invalidateCache(paths: string[]): Promise<void> {
    await this.cdn.createInvalidation({
      distributionId: this.configService.get('CLOUDFRONT_DISTRIBUTION_ID'),
      paths,
    });
  }
}
```
