import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class MergePatchValidationPipe implements PipeTransform {
  transform(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('JSON Merge Patch body must be a JSON object');
    }
    return value as Record<string, unknown>;
  }
}
