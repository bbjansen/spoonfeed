import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private readonly prefix = 'FF_';

  constructor(private readonly config: ConfigService) {}

  isEnabled(flagName: string): boolean {
    const key = this.resolveKey(flagName);
    const value = this.config.get<string>(key);

    if (value === undefined) {
      this.logger.debug(`Feature flag "${flagName}" not configured, defaulting to disabled`);
      return false;
    }

    return value === 'true' || value === '1';
  }

  isDisabled(flagName: string): boolean {
    return !this.isEnabled(flagName);
  }

  getValue<T extends string = string>(flagName: string, defaultValue: T): T {
    const key = this.resolveKey(flagName);
    return this.config.get<T>(key, defaultValue);
  }

  getAllFlags(): Record<string, string> {
    const flags: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(this.prefix) && value !== undefined) {
        const flagName = key.slice(this.prefix.length);
        flags[flagName] = value;
      }
    }

    return flags;
  }

  private resolveKey(flagName: string): string {
    return flagName.startsWith(this.prefix) ? flagName : `${this.prefix}${flagName}`;
  }
}
