import { TenantContextMiddleware } from './tenant-context.middleware';
import { TenantContext } from '../../prisma/tenant-context';
import { Request, Response } from 'express';

describe('TenantContextMiddleware', () => {
  let middleware: TenantContextMiddleware;
  let tenantContext: TenantContext;

  beforeEach(() => {
    tenantContext = new TenantContext();
    middleware = new TenantContextMiddleware(tenantContext);
  });

  function createMockReq(user?: any): Request {
    return { user } as any;
  }

  function createMockRes(): Response {
    return {} as any;
  }

  it('should call next() without tenant context when user is not set', (done) => {
    const req = createMockReq(undefined);
    const res = createMockRes();

    const next = () => {
      // Should NOT be inside tenant context
      expect(tenantContext.getTenantId()).toBeUndefined();
      done();
    };

    middleware.use(req, res, next);
  });

  it('should call next() without tenant context when tenantId is missing', (done) => {
    const req = createMockReq({ sub: 'user-1', email: 'test@test.com' });
    const res = createMockRes();

    const next = () => {
      expect(tenantContext.getTenantId()).toBeUndefined();
      done();
    };

    middleware.use(req, res, next);
  });

  it('should wrap next() in tenant context when tenantId is present', (done) => {
    const req = createMockReq({
      sub: 'user-1',
      email: 'test@test.com',
      tenantId: 'tenant-abc',
    });
    const res = createMockRes();

    const next = () => {
      // Should be inside tenant context with the correct tenantId
      expect(tenantContext.getTenantId()).toBe('tenant-abc');
      done();
    };

    middleware.use(req, res, next);
  });

  it('should propagate tenant context to nested async operations', (done) => {
    const req = createMockReq({
      sub: 'user-1',
      tenantId: 'tenant-xyz',
    });
    const res = createMockRes();

    const next = () => {
      // Simulate async operation that reads tenant context
      setTimeout(() => {
        expect(tenantContext.getTenantId()).toBe('tenant-xyz');
        done();
      }, 0);
    };

    middleware.use(req, res, next);
  });

  it('should isolate tenant contexts between requests', () => {
    const req1 = createMockReq({ sub: 'u1', tenantId: 'tenant-1' });
    const req2 = createMockReq({ sub: 'u2', tenantId: 'tenant-2' });
    const res = createMockRes();

    const results: (string | undefined)[] = [];

    // Simulate two concurrent requests
    middleware.use(req1, res, () => {
      results.push(tenantContext.getTenantId());
    });

    middleware.use(req2, res, () => {
      results.push(tenantContext.getTenantId());
    });

    expect(results).toEqual(['tenant-1', 'tenant-2']);
  });
});
