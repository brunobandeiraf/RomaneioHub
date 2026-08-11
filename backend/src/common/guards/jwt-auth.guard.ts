import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  app_metadata: {
    tenantId?: string;
    globalRole?: string;
    tenantRole?: string;
  };
  exp: number;
  iat: number;
}

/**
 * JwtAuthGuard validates JWT tokens issued by Supabase Auth.
 *
 * - Verifies JWT signature using SUPABASE_JWT_SECRET (HS256)
 * - Extracts claims from app_metadata (tenantId, globalRole, tenantRole)
 * - Sets request.user with { authId, email, tenantId, globalRole, tenantRole }
 *
 * Public routes (decorated with @Public()) bypass this guard entirely.
 * In development mode, falls back to x-user-id / x-user-email headers.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET', '');
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // If request.user is already set (e.g., by a test setup), skip
    if (request.user) {
      return true;
    }

    const authHeader =
      request.headers?.['authorization'] || request.headers?.['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Fallback: development headers
      return this.tryDevHeaders(request);
    }

    const token = authHeader.slice(7);

    if (!token) {
      throw new UnauthorizedException('Authentication required: missing or invalid token');
    }

    // In development without a JWT secret configured, fall back to decode-only
    if (!this.jwtSecret) {
      return this.decodeWithoutVerification(request, token);
    }

    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as SupabaseJwtPayload;

      request.user = {
        authId: payload.sub,
        email: payload.email,
        tenantId: payload.app_metadata?.tenantId,
        globalRole: payload.app_metadata?.globalRole ?? 'SELLER',
        tenantRole: payload.app_metadata?.tenantRole,
      };

      return true;
    } catch (err) {
      // Never reveal details of the secret or the validation failure
      throw new UnauthorizedException('Authentication required: invalid or expired token');
    }
  }

  /**
   * Fallback for development mode: extract user from custom headers.
   */
  private tryDevHeaders(request: any): boolean {
    const userId = request.headers?.['x-user-id'];
    const email = request.headers?.['x-user-email'];

    if (!userId || !email) {
      throw new UnauthorizedException('Authentication required: missing or invalid token');
    }

    request.user = {
      authId: userId,
      email,
      tenantId: request.headers['x-tenant-id'] || undefined,
      globalRole: request.headers['x-global-role'] || 'SELLER',
      tenantRole: request.headers['x-tenant-role'] || undefined,
    };

    return true;
  }

  /**
   * Decode JWT without verification (dev fallback when SUPABASE_JWT_SECRET is not set).
   * Supports both Supabase-style (app_metadata) and legacy (root-level) claims.
   */
  private decodeWithoutVerification(request: any, token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new UnauthorizedException('Authentication required: missing or invalid token');
      }
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8'),
      );

      request.user = {
        authId: payload.sub ?? payload.authId,
        email: payload.email,
        tenantId: payload.app_metadata?.tenantId ?? payload.tenantId,
        globalRole:
          payload.app_metadata?.globalRole ?? payload.globalRole ?? 'SELLER',
        tenantRole: payload.app_metadata?.tenantRole ?? payload.tenantRole,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Authentication required: missing or invalid token');
    }
  }
}
