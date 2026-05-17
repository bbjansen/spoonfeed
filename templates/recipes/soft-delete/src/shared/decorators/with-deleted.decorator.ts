import { SetMetadata } from '@nestjs/common';

export const WITH_DELETED_KEY = 'WITH_DELETED';
export const WithDeleted = () => SetMetadata(WITH_DELETED_KEY, true);
