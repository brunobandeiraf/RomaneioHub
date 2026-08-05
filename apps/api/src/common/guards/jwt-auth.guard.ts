import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JwtAuthGuard validates JWT tokens and sets request.user with decoded claims.
 *
 * In production, this guard will:
 * - Validate JWT tokens using aws-jwt-verify against the Cognito User Pool
 * - Extract claims (sub, email, custom:tenantId, custom:globalRole, custom:tenantRole)
 * - Set request.user with the authenticated user context
 *
 * Current implementation:
 * - Checks for Authorization: Bearer <token> header
 * - Decodes the JWT payload (base64) without cryptographic verification
 * - Sets request.user with { userId, email, tenantId, globalRole, tenantRole }
 *
 * Public routes (decorated with @Public()) bypass this guard entirely.
 *
 * TODO: Integrate aws-jwt-verify for proper JWT signature validation against Cognito
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // If request.user is already set (e.g., by a previous middleware or test setup), skip
    if (request.user) {
      return true;
    }

    const authHeader = request.headers?.['authorization'] || request.headers?.['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Fallback: check development headers (x-user-id, x-user-email, etc.)
      return this.tryDevHeaders(request);
    }

    const token = authHeader.slice(7); // Remove 'Bearer '

    if (!token) {
      throw new UnauthorizedException(
        'Authentication required: missing or invalid token',
      );
    }

    // TODO: Replace with aws-jwt-verify for proper signature validation
    const payload = this.decodeJwtPayload(token);

    if (!payload) {
      throw new UnauthorizedException(
        'Authentication required: missing or invalid token',
      );
    }

    request.user = {
      userId: payload.sub || payload.userId,
      email: payload.email,
      tenantId: payload.tenantId || payload['custom:tenantId'],
      globalRole: payload.globalRole || payload['custom:globalRole'] || 'SELLER',
      tenantRole: payload.tenantRole || payload['custom:tenantRole'],
    };

    return true;
  }

  /**
   * Decodes a JWT payload without verification.
   * TODO: Replace with aws-jwt-verify for production use.
   */
  private decodeJwtPayload(token: string): Record<string, any> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Fallback for development mode: extract user from custom headers.
   * This allows testing without a real JWT token.
   */
  private tryDevHeaders(request: any): boolean {
    const userId = request.headers?.['x-user-id'];
    const email = request.headers?.['x-user-email'];

    if (!userId || !email) {
      throw new UnauthorizedException(
        'Authentication required: missing or invalid token',
      );
    }

    const tenantId = request.headers['x-tenant-id'];
    const globalRole = request.headers['x-global-role'];
    const tenantRole = request.headers['x-tenant-role'];

    request.user = {
      userId,
      email,
      tenantId: tenantId || undefined,
      globalRole: globalRole || 'SELLER',
      tenantRole: tenantRole || undefined,
    };

    return true;
  }
}
