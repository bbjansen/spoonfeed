import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PaginatedQuery } from '@/shared/dto/pagination.dto';
import { FastifyRequest } from 'fastify';

export const Paginate = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PaginatedQuery => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const query = request.query as Record<string, string>;

    const pagination = plainToInstance(PaginatedQuery, {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    });

    const errors = validateSync(pagination);

    if (errors.length > 0) {
      return plainToInstance(PaginatedQuery, { page: 1, limit: 20 });
    }

    return pagination;
  },
);
