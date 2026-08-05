import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ValidationError {
  property: string;
  constraints: Record<string, string>;
}

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  error: string;
  errors?: ValidationError[];
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string;
    let error: string;
    let errors: ValidationError[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (statusCode === HttpStatus.BAD_REQUEST) {
        // Validation errors from ValidationPipe
        if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
          const resp = exceptionResponse as Record<string, unknown>;
          message = typeof resp.message === 'string'
            ? resp.message
            : 'Validation failed';
          error = (resp.error as string) || 'Bad Request';

          // Pass through structured validation errors if present
          if (Array.isArray(resp.errors)) {
            errors = resp.errors as ValidationError[];
          }
        } else {
          message = 'Bad Request';
          error = 'Bad Request';
        }
      } else if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
        // Never expose internal details for 5xx errors
        message = 'Internal server error';
        error = 'Internal Server Error';
      } else {
        // Other HTTP exceptions (401, 403, 404, etc.)
        if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
          const resp = exceptionResponse as Record<string, unknown>;
          message = typeof resp.message === 'string'
            ? resp.message
            : exception.message;
          error = (resp.error as string) || HttpStatus[statusCode] || 'Error';
        } else {
          message =
            typeof exceptionResponse === 'string'
              ? exceptionResponse
              : exception.message;
          error = HttpStatus[statusCode] || 'Error';
        }
      }
    } else {
      // Unknown/unhandled exceptions — never expose internals
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'Internal Server Error';
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (errors) {
      body.errors = errors;
    }

    response.status(statusCode).json(body);
  }
}
