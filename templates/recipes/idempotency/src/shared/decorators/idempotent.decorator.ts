import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'IDEMPOTENT';
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
