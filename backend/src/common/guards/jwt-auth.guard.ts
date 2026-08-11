import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
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
 * Supabase projects can sign tokens either with the legacy shared secret
 * (HS256, via SUPABASE_JWT_SECRET) or with asymmetric JWT signing keys
 * (ES256/RS256, verified against the project's JWKS endpoint). This guard
 * inspects the token header and verifies against whichever scheme it was
 * signed with.
 *
 * - Extracts claims from app_metadata (tenantId, globalRole, tenantRole)
 * - Sets request.user with { authId, email, tenantId, globalRole, tenantRole }
 *
 * Public routes (decorated with @Public()) bypass this guard entirely.
 * In development mode, falls back to x-user-id / x-user-email headers.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;
  private readonly issuer: string | null;
  private readonly isProduction: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET', '');
    this.isProduction = this.configService.get<string>('NODE_ENV', '') === 'production';

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL', '');
    if (supabaseUrl) {
      this.jwks = createRemoteJWKSet(
        new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
      );
      this.issuer = `${supabaseUrl}/auth/v1`;
    } else {
      this.jwks = null;
      this.issuer = null;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const alg = this.peekAlgorithm(token);

    // Asymmetric signing keys (Supabase's JWT Signing Keys system) must be
    // verified against the project's JWKS — a static shared secret can't do it.
    if (alg && alg !== 'HS256') {
      return this.verifyWithJwks(request, token);
    }

    // In development without a JWT secret configured, fall back to decode-only.
    // Never allowed in production — an unsigned/unverified token would be trivial to forge.
    if (!this.jwtSecret) {
      if (this.isProduction) {
        throw new UnauthorizedException('Authentication required: invalid or expired token');
      }
      return this.decodeWithoutVerification(request, token);
    }

    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as SupabaseJwtPayload;

      this.setUserFromClaims(request, payload.sub, payload.email, payload.app_metadata);

      return true;
    } catch {
      // Never reveal details of the secret or the validation failure
      throw new UnauthorizedException('Authentication required: invalid or expired token');
    }
  }

  /**
   * Reads the `alg` field from the JWT header without verifying the token.
   * Used only to route to the correct verification strategy.
   */
  private peekAlgorithm(token: string): string | null {
    try {
      const [headerB64] = token.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
      return typeof header.alg === 'string' ? header.alg : null;
    } catch {
      return null;
    }
  }

  private async verifyWithJwks(request: any, token: string): Promise<boolean> {
    if (!this.jwks) {
      throw new UnauthorizedException('Authentication required: invalid or expired token');
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer ?? undefined,
      });

      const claims = payload as JWTPayload & {
        email?: string;
        app_metadata?: SupabaseJwtPayload['app_metadata'];
      };

      this.setUserFromClaims(request, claims.sub, claims.email, claims.app_metadata);

      return true;
    } catch {
      throw new UnauthorizedException('Authentication required: invalid or expired token');
    }
  }

  private setUserFromClaims(
    request: any,
    authId: string | undefined,
    email: string | undefined,
    appMetadata: SupabaseJwtPayload['app_metadata'] | undefined,
  ): void {
    request.user = {
      authId,
      email,
      tenantId: appMetadata?.tenantId,
      globalRole: appMetadata?.globalRole ?? 'SELLER',
      tenantRole: appMetadata?.tenantRole,
    };
  }

  /**
   * Fallback for development mode: extract user from custom headers.
   * Never active in production — these headers are trivially spoofable.
   */
  private tryDevHeaders(request: any): boolean {
    if (this.isProduction) {
      throw new UnauthorizedException('Authentication required: missing or invalid token');
    }

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
