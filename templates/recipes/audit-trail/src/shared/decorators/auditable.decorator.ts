import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'AUDITABLE';
export const Auditable = () => SetMetadata(AUDITABLE_KEY, true);
