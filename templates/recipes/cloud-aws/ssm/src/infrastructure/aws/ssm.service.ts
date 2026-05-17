import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
  type ParameterType,
} from '@aws-sdk/client-ssm';

@Injectable()
export class SsmService {
  private readonly client: SSMClient;
  private readonly logger = new Logger(SsmService.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new SSMClient({
      region: this.configService.get<string>('AWS_REGION', 'eu-west-1'),
    });
  }

  async getParameter(name: string, withDecryption = true): Promise<string> {
    const result = await this.client.send(
      new GetParameterCommand({
        Name: name,
        WithDecryption: withDecryption,
      }),
    );

    if (!result.Parameter?.Value) {
      throw new Error(`Parameter "${name}" not found or has no value`);
    }

    this.logger.debug(`Retrieved parameter: ${name}`);
    return result.Parameter.Value;
  }

  async putParameter(
    name: string,
    value: string,
    type: ParameterType = 'String',
    overwrite = true,
  ): Promise<number> {
    const result = await this.client.send(
      new PutParameterCommand({
        Name: name,
        Value: value,
        Type: type,
        Overwrite: overwrite,
      }),
    );
    this.logger.debug(`Put parameter: ${name} (version ${result.Version})`);
    return result.Version!;
  }
}
