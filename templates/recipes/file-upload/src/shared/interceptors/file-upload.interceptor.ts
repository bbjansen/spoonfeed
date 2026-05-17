import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FastifyRequest } from 'fastify';

@Injectable()
export class FileUploadInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (!request.isMultipart()) {
      throw new BadRequestException('Expected multipart/form-data');
    }

    const file = await request.file();
    if (!file) throw new BadRequestException('No file in request');

    (request as any).uploadedFile = {
      filename: file.filename,
      mimetype: file.mimetype,
      encoding: file.encoding,
      file: file.file,
      fieldname: file.fieldname,
    };

    return next.handle();
  }
}
