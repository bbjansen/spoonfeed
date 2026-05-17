# GCP Cloud CDN

Google Cloud CDN for content delivery with signed URL support in NestJS.

## Documentation

- [GCP Cloud CDN Documentation](https://cloud.google.com/cdn/docs)
- [Cloud CDN Signed URLs](https://cloud.google.com/cdn/docs/using-signed-urls)

## Dependencies

No additional npm dependencies are required. Signed URL generation uses Node.js built-in `crypto` module.

## Environment Variables

| Variable               | Default | Description                    |
| ---------------------- | ------- | ------------------------------ |
| `GCP_PROJECT_ID`       | —       | GCP project ID                 |
| `CDN_SIGNING_KEY_NAME` | —       | Cloud CDN signing key name     |
| `CDN_SIGNING_KEY`      | —       | Cloud CDN signing key (base64) |

## Usage

```typescript
import { CdnService } from '@/gcp/cdn.service';

@Injectable()
export class AssetService {
  constructor(private readonly cdn: CdnService) {}

  getSignedUrl(path: string, expiresInSeconds: number): string {
    return this.cdn.createSignedUrl({
      baseUrl: `https://cdn.example.com${path}`,
      keyName: this.configService.get('CDN_SIGNING_KEY_NAME'),
      key: this.configService.get('CDN_SIGNING_KEY'),
      expiration: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
  }
}
```
