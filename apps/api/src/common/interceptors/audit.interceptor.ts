import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@compras-hub/db';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDITABLE_KEY } from '../decorators/auditable.decorator';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

interface AuthenticatedRequest extends Request {
  user?: { sub?: string };
  tenantId?: string;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entityType = this.reflector.get<string | undefined>(
      AUDITABLE_KEY,
      context.getHandler(),
    );

    // Skip auditing if @Auditable decorator is not present
    if (!entityType) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = request.method.toUpperCase();
    const action = this.mapHttpMethodToAction(method);

    // Skip if the HTTP method does not map to an auditable action
    if (!action) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((responseBody) => {
        const userId = request.user?.sub;
        const tenantId = request.tenantId;

        if (!userId || !tenantId) {
          return;
        }

        const entityId = this.extractEntityId(action, responseBody, request);
        const changes = this.extractChanges(action, request);

        // Fire-and-forget: write audit log without blocking the response
        this.prisma.auditLog
          .create({
            data: {
              tenantId,
              userId,
              action,
              entityType,
              entityId: entityId ?? 'unknown',
              changes: changes === null
                ? Prisma.JsonNull
                : (changes as Prisma.InputJsonValue),
            },
          })
          .catch(() => {
            // Silently fail — audit logging should not break the request
          });
      }),
    );
  }

  private mapHttpMethodToAction(method: string): AuditAction | null {
    switch (method) {
      case 'POST':
        return 'CREATE';
      case 'PATCH':
      case 'PUT':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return null;
    }
  }

  private extractEntityId(
    action: AuditAction,
    responseBody: unknown,
    request: AuthenticatedRequest,
  ): string | undefined {
    // For CREATE and UPDATE, try to get id from response body
    if (action === 'CREATE' || action === 'UPDATE') {
      if (
        responseBody &&
        typeof responseBody === 'object' &&
        'id' in responseBody
      ) {
        return String((responseBody as Record<string, unknown>).id);
      }
    }

    // For DELETE (or fallback), get from route params
    const paramId = request.params?.id;
    return Array.isArray(paramId) ? paramId[0] : paramId;
  }

  private extractChanges(
    action: AuditAction,
    request: AuthenticatedRequest,
  ): Record<string, unknown> | null {
    switch (action) {
      case 'CREATE':
        // Store the entire request body for CREATE
        return request.body && typeof request.body === 'object'
          ? (request.body as Record<string, unknown>)
          : null;
      case 'UPDATE':
        // Store the partial body for UPDATE
        return request.body && typeof request.body === 'object'
          ? (request.body as Record<string, unknown>)
          : null;
      case 'DELETE':
        // No changes payload for DELETE
        return null;
      default:
        return null;
    }
  }
}
