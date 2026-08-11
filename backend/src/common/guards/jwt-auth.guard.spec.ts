import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

const TEST_JWT_SECRET = 'test-secret-for-unit-tests';

function createConfigService(secret = '', nodeEnv = ''): ConfigService {
  return {
    get: (_key: string, defaultValue = '') => {
      if (_key === 'SUPABASE_JWT_SECRET') return secret;
      if (_key === 'SUPABASE_URL') return '';
      if (_key === 'NODE_ENV') return nodeEnv;
      return defaultValue;
    },
  } as unknown as ConfigService;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector, createConfigService());
  });

  function createMockContext(
    headers: Record<string, string | undefined> = {},
    user?: any,
    isPublic = false,
  ): ExecutionContext {
    const request = { headers, user } as any;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  function getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest() as any;
  }

  describe('public routes', () => {
    it('should allow access on public routes without headers', async () => {
      const context = createMockContext({}, undefined, true);
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });

  describe('when request.user is already set', () => {
    it('should pass through without modifying user', async () => {
      const existingUser = { id: 'existing', email: 'a@b.com', tenantId: 't1' };
      const context = createMockContext({}, existingUser);

      await expect(guard.canActivate(context)).resolves.toBe(true);

      const req = getRequest(context);
      expect(req.user).toBe(existingUser);
    });
  });

  describe('development mode (header-based auth)', () => {
    it('should set request.user from headers', async () => {
      const context = createMockContext({
        'x-user-id': 'user-1',
        'x-user-email': 'test@example.com',
        'x-tenant-id': 'tenant-abc',
        'x-global-role': 'SELLER',
        'x-tenant-role': 'SELLER',
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      const req = getRequest(context);
      expect(req.user).toEqual({
        authId: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-abc',
        globalRole: 'SELLER',
        tenantRole: 'SELLER',
      });
    });

    it('should set globalRole to SELLER by default', async () => {
      const context = createMockContext({
        'x-user-id': 'user-1',
        'x-user-email': 'test@example.com',
        'x-tenant-id': 'tenant-abc',
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      const req = getRequest(context);
      expect(req.user.globalRole).toBe('SELLER');
    });

    it('should set tenantId to undefined when header is missing', async () => {
      const context = createMockContext({
        'x-user-id': 'admin-1',
        'x-user-email': 'admin@example.com',
        'x-global-role': 'ADMIN',
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      const req = getRequest(context);
      expect(req.user.tenantId).toBeUndefined();
    });

    it('should throw UnauthorizedException when x-user-id is missing', async () => {
      const context = createMockContext({
        'x-user-email': 'test@example.com',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when x-user-email is missing', async () => {
      const context = createMockContext({
        'x-user-id': 'user-1',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no auth headers are present', async () => {
      const context = createMockContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('production mode (spoofable headers must be rejected)', () => {
    beforeEach(() => {
      guard = new JwtAuthGuard(reflector, createConfigService('', 'production'));
    });

    it('should reject x-user-id/x-user-email headers even with no other auth present', async () => {
      const context = createMockContext({
        'x-user-id': 'attacker-id',
        'x-user-email': 'attacker@evil.com',
        'x-global-role': 'ADMIN',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an unverified token when no JWT secret is configured', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payloadObj = {
        sub: 'attacker-id',
        email: 'attacker@evil.com',
        app_metadata: { globalRole: 'ADMIN' },
      };
      const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
      const token = `${header}.${payload}.fakesig`;

      const context = createMockContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('JWT Bearer token (no secret — decode-only mode)', () => {
    it('should decode a Supabase-style JWT (app_metadata) without verification', async () => {
      // Build a token without signing (3-part structure with base64url payload)
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payloadObj = {
        sub: 'uuid-123',
        email: 'user@example.com',
        app_metadata: {
          tenantId: 'tenant-1',
          globalRole: 'ADMIN',
          tenantRole: 'MANAGER',
        },
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
      const token = `${header}.${payload}.fakesig`;

      const context = createMockContext({
        authorization: `Bearer ${token}`,
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      const req = getRequest(context);
      expect(req.user).toEqual({
        authId: 'uuid-123',
        email: 'user@example.com',
        tenantId: 'tenant-1',
        globalRole: 'ADMIN',
        tenantRole: 'MANAGER',
      });
    });

    it('should default globalRole to SELLER when missing from app_metadata', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payloadObj = {
        sub: 'uuid-456',
        email: 'seller@example.com',
        app_metadata: {},
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
      const token = `${header}.${payload}.fakesig`;

      const context = createMockContext({ authorization: `Bearer ${token}` });
      await guard.canActivate(context);

      const req = getRequest(context);
      expect(req.user.globalRole).toBe('SELLER');
    });
  });

  describe('JWT Bearer token (with secret — verified mode)', () => {
    beforeEach(() => {
      guard = new JwtAuthGuard(reflector, createConfigService(TEST_JWT_SECRET));
    });

    it('should accept a valid signed JWT and populate request.user', async () => {
      const token = jwt.sign(
        {
          sub: 'auth-uuid-789',
          email: 'signed@example.com',
          app_metadata: {
            tenantId: 'tenant-x',
            globalRole: 'SELLER',
            tenantRole: 'SELLER',
          },
        },
        TEST_JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' },
      );

      const context = createMockContext({ authorization: `Bearer ${token}` });
      await expect(guard.canActivate(context)).resolves.toBe(true);

      const req = getRequest(context);
      expect(req.user.authId).toBe('auth-uuid-789');
      expect(req.user.email).toBe('signed@example.com');
      expect(req.user.tenantId).toBe('tenant-x');
    });

    it('should throw UnauthorizedException for a tampered token', async () => {
      const token = jwt.sign({ sub: 'x', email: 'x@x.com', app_metadata: {} }, 'wrong-secret');

      const context = createMockContext({ authorization: `Bearer ${token}` });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for an expired token', async () => {
      const token = jwt.sign(
        { sub: 'x', email: 'x@x.com', app_metadata: {} },
        TEST_JWT_SECRET,
        { expiresIn: '-1s' },
      );

      const context = createMockContext({ authorization: `Bearer ${token}` });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
