import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CosmosClient, Container, ItemDefinition, SqlQuerySpec, FeedResponse } from '@azure/cosmos';

@Injectable()
export class CosmosDbService {
  private readonly logger = new Logger(CosmosDbService.name);
  private readonly client: CosmosClient;
  private readonly databaseId: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.getOrThrow<string>('AZURE_COSMOS_ENDPOINT');
    const key = this.config.getOrThrow<string>('AZURE_COSMOS_KEY');
    this.databaseId = this.config.getOrThrow<string>('AZURE_COSMOS_DATABASE');
    this.client = new CosmosClient({ endpoint, key });
  }

  async getItem<T extends ItemDefinition>(
    containerId: string,
    id: string,
    partitionKey: string,
  ): Promise<T> {
    const container = this.getContainer(containerId);
    const { resource } = await container.item(id, partitionKey).read<T>();
    this.logger.log(`Retrieved item "${id}" from "${containerId}"`);
    return resource as T;
  }

  async createItem<T extends ItemDefinition>(containerId: string, item: T): Promise<T> {
    const container = this.getContainer(containerId);
    const { resource } = await container.items.create<T>(item);
    this.logger.log(`Created item in "${containerId}"`);
    return resource as T;
  }

  async queryItems<T extends ItemDefinition>(
    containerId: string,
    query: SqlQuerySpec,
  ): Promise<T[]> {
    const container = this.getContainer(containerId);
    const { resources }: FeedResponse<T> = await container.items.query<T>(query).fetchAll();
    this.logger.log(`Query returned ${resources.length} item(s) from "${containerId}"`);
    return resources;
  }

  async deleteItem(containerId: string, id: string, partitionKey: string): Promise<void> {
    const container = this.getContainer(containerId);
    await container.item(id, partitionKey).delete();
    this.logger.log(`Deleted item "${id}" from "${containerId}"`);
  }

  private getContainer(containerId: string): Container {
    return this.client.database(this.databaseId).container(containerId);
  }
}
