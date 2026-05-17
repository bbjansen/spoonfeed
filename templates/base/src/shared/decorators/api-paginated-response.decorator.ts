import { applyDecorators, Type } from '@nestjs/common';

/**
 * Decorator placeholder for paginated API responses.
 * When @nestjs/swagger is installed, this can be expanded with ApiExtraModels and ApiOkResponse.
 * Without swagger, it's a no-op decorator.
 */
export function ApiPaginatedResponse<T>(dataDto: Type<T>) {
  return applyDecorators();
}
