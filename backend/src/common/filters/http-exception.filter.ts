import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let message: string | string[] = 'An unexpected error occurred.';
    let code: string | undefined;
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      message = typeof body === 'string' ? body : (body as { message?: string | string[] }).message ?? error.message;
      const bodyCode = typeof body === 'object' ? (body as { code?: unknown }).code : undefined;
      // Only machine-readable codes (e.g. AUTH_INVALID_CREDENTIALS) reach the client, so the frontend can translate them.
      if (typeof bodyCode === 'string' && /^[A-Z_]+$/.test(bodyCode)) code = bodyCode;
    } else {
      const databaseError = error as { code?: string; errno?: number; driverError?: { code?: string; errno?: number } } | null;
      const driver = databaseError?.driverError ?? databaseError;
      if (driver?.errno === 1062 || driver?.code === 'ER_DUP_ENTRY') {
        status = 409;
        message = 'A record with those unique details already exists.';
      } else {
        this.logger.error('Unhandled server error', error instanceof Error ? error.name : 'Unknown error');
      }
    }
    response.status(status).json({ statusCode: status, message, ...(code ? { code } : {}), timestamp: new Date().toISOString() });
  }
}
