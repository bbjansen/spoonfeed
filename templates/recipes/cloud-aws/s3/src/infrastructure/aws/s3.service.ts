import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type Readable } from 'stream';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly logger = new Logger(S3Service.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'eu-west-1'),
    });
  }

  async upload(bucket: string, key: string, body: Buffer | Readable | string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
    this.logger.debug(`Uploaded s3://${bucket}/${key}`);
  }

  async download(bucket: string, key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return result.Body as Readable;
  }

  async getPresignedUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    this.logger.debug(`Deleted s3://${bucket}/${key}`);
  }
}
