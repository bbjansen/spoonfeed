import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDbService {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly logger = new Logger(DynamoDbService.name);

  constructor(private readonly configService: ConfigService) {
    const client = new DynamoDBClient({
      region: this.configService.get<string>('AWS_REGION', 'eu-west-1'),
    });
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  async get(
    tableName: string,
    key: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    const result = await this.docClient.send(new GetCommand({ TableName: tableName, Key: key }));
    this.logger.debug(`Get from ${tableName}`);
    return result.Item as Record<string, unknown> | undefined;
  }

  async put(tableName: string, item: Record<string, unknown>): Promise<void> {
    await this.docClient.send(new PutCommand({ TableName: tableName, Item: item }));
    this.logger.debug(`Put item to ${tableName}`);
  }

  async query(params: QueryCommandInput): Promise<Record<string, unknown>[]> {
    const result = await this.docClient.send(new QueryCommand(params));
    this.logger.debug(`Query ${params.TableName}: ${result.Count} item(s)`);
    return (result.Items as Record<string, unknown>[]) ?? [];
  }

  async delete(tableName: string, key: Record<string, unknown>): Promise<void> {
    await this.docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
    this.logger.debug(`Deleted item from ${tableName}`);
  }
}
