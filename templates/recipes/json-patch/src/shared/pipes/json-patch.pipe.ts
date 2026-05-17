import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

@Injectable()
export class JsonPatchValidationPipe implements PipeTransform<unknown, JsonPatchOperation[]> {
  transform(value: unknown): JsonPatchOperation[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException('JSON Patch body must be an array of operations');
    }

    const validOps = new Set(['add', 'remove', 'replace', 'move', 'copy', 'test']);

    for (const op of value) {
      if (!op || typeof op !== 'object') {
        throw new BadRequestException('Each operation must be an object');
      }
      if (!validOps.has(op.op)) {
        throw new BadRequestException(`Invalid operation: ${op.op}`);
      }
      if (typeof op.path !== 'string' || !op.path.startsWith('/')) {
        throw new BadRequestException('Operation path must start with /');
      }
      if (['add', 'replace', 'test'].includes(op.op) && op.value === undefined) {
        throw new BadRequestException(`Operation ${op.op} requires a value`);
      }
      if (['move', 'copy'].includes(op.op) && typeof op.from !== 'string') {
        throw new BadRequestException(`Operation ${op.op} requires a from field`);
      }
    }

    return value as JsonPatchOperation[];
  }
}
