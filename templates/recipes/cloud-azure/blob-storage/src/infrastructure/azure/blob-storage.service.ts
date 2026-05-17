import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlobServiceClient,
  BlockBlobClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';

@Injectable()
export class BlobStorageService {
  private readonly logger = new Logger(BlobStorageService.name);
  private readonly blobServiceClient: BlobServiceClient;
  private readonly accountName: string;
  private readonly accountKey: string;

  constructor(private readonly config: ConfigService) {
    this.accountName = this.config.getOrThrow<string>('AZURE_STORAGE_ACCOUNT_NAME');
    this.accountKey = this.config.getOrThrow<string>('AZURE_STORAGE_ACCOUNT_KEY');

    const credential = new StorageSharedKeyCredential(this.accountName, this.accountKey);
    this.blobServiceClient = new BlobServiceClient(
      `https://${this.accountName}.blob.core.windows.net`,
      credential,
    );
  }

  async upload(container: string, blobName: string, data: Buffer): Promise<void> {
    const client = this.getBlockBlobClient(container, blobName);
    await client.uploadData(data);
    this.logger.log(`Uploaded blob "${blobName}" to "${container}"`);
  }

  async download(container: string, blobName: string): Promise<Buffer> {
    const client = this.getBlockBlobClient(container, blobName);
    const response = await client.downloadToBuffer();
    this.logger.log(`Downloaded blob "${blobName}" from "${container}"`);
    return response;
  }

  generateSasUrl(container: string, blobName: string, expiresInMinutes = 60): string {
    const credential = new StorageSharedKeyCredential(this.accountName, this.accountKey);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60_000);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: container,
        blobName,
        permissions: BlobSASPermissions.parse('r'),
        startsOn,
        expiresOn,
      },
      credential,
    ).toString();

    return `https://${this.accountName}.blob.core.windows.net/${container}/${blobName}?${sasToken}`;
  }

  private getBlockBlobClient(container: string, blobName: string): BlockBlobClient {
    return this.blobServiceClient.getContainerClient(container).getBlockBlobClient(blobName);
  }
}
