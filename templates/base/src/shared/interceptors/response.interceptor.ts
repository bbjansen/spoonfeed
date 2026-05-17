import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface DataResponse<T> {
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, DataResponse<T> | undefined> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<DataResponse<T> | undefined> {
    return next.handle().pipe(
      map((data) => {
        if (data === undefined || data === null) return undefined;
        return { data };
      }),
    );
  }
}
