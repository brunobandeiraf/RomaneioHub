import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@compras-hub/db';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AUDITABLE_KEY } from '../decorators/auditable.decorator';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let reflector: Reflector;
  let mockPrismaService: any;

  beforeEach(() => {
    reflector = new Reflector();
    mockPrismaService = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    interceptor = new AuditInterceptor(reflector, mockPrismaService);
  });

  function createMockExecutionContext(overrides: {
    method?: string;
    body?: any;
    params?: any;
    user?: any;
    tenantId?: string | null;
  }): ExecutionContext {
    const request: Record<string, any> = {
      method: overrides.method ?? 'POST',
      body: overrides.body ?? {},
      params: overrides.params ?? {},
      user: overrides.user ?? { sub: 'user-123' },
    };

    // Only set tenantId if not explicitly null/undefined in overrides
    if ('tenantId' in overrides) {
      request.tenantId = overrides.tenantId ?? undefined;
    } else {
      request.tenantId = 'tenant-456';
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => jest.fn(),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  function createMockCallHandler(response: any): CallHandler {
    return {
      handle: () => of(response),
    };
  }

  it('should skip auditing when @Auditable decorator is not present', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const context = createMockExecutionContext({ method: 'POST' });
    const handler = createMockCallHandler({ id: 'new-1' });

    interceptor.intercept(context, handler).subscribe(() => {
      expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
      done();
    });
  });

  it('should skip auditing for GET requests', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('Supplier');

    const context = createMockExecutionContext({ method: 'GET' });
    const handler = createMockCallHandler([]);

    interceptor.intercept(context, handler).subscribe(() => {
      expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
      done();
    });
  });

  it('should write audit log for POST (CREATE) with entity id from response', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('Supplier');

    const context = createMockExecutionContext({
      method: 'POST',
      body: { razaoSocial: 'Test Corp', cnpj: '12345678000100' },
      user: { sub: 'user-abc' },
      tenantId: 'tenant-xyz',
    });
    const handler = createMockCallHandler({ id: 'supplier-1', razaoSocial: 'Test Corp' });

    interceptor.intercept(context, handler).subscribe(() => {
      // Allow the async fire-and-forget to complete
      setImmediate(() => {
        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
          data: {
            tenantId: 'tenant-xyz',
            userId: 'user-abc',
            action: 'CREATE',
            entityType: 'Supplier',
            entityId: 'supplier-1',
            changes: { razaoSocial: 'Test Corp', cnpj: '12345678000100' },
          },
        });
        done();
      });
    });
  });

  it('should write audit log for PATCH (UPDATE) with partial body as changes', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('Product');

    const context = createMockExecutionContext({
      method: 'PATCH',
      body: { nome: 'Updated Product' },
      params: { id: 'product-99' },
      user: { sub: 'user-def' },
      tenantId: 'tenant-111',
    });
    const handler = createMockCallHandler({ id: 'product-99', nome: 'Updated Product' });

    interceptor.intercept(context, handler).subscribe(() => {
      setImmediate(() => {
        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
          data: {
            tenantId: 'tenant-111',
            userId: 'user-def',
            action: 'UPDATE',
            entityType: 'Product',
            entityId: 'product-99',
            changes: { nome: 'Updated Product' },
          },
        });
        done();
      });
    });
  });

  it('should write audit log for PUT (UPDATE)', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('Order');

    const context = createMockExecutionContext({
      method: 'PUT',
      body: { status: 'CONFIRMED' },
      params: { id: 'order-5' },
      user: { sub: 'user-put' },
      tenantId: 'tenant-put',
    });
    const handler = createMockCallHandler({ id: 'order-5', status: 'CONFIRMED' });

    interceptor.intercept(context, handler).subscribe(() => {
      setImmediate(() => {
        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
          data: {
            tenantId: 'tenant-put',
            userId: 'user-put',
            action: 'UPDATE',
            entityType: 'Order',
            entityId: 'order-5',
            changes: { status: 'CONFIRMED' },
          },
        });
        done();
      });
    });
  });

  it('should write audit log for DELETE with entity id from route params', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('Supplier');

    const context = createMockExecutionContext({
      method: 'DELETE',
      params: { id: 'supplier-77' },
      user: { sub: 'user-del' },
      tenantId: 'tenant-del',
    });
    const handler = createMockCallHandler({ success: true });

    interceptor.intercept(context, handler).subscribe(() => {
      setImmediate(() => {
        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
          data: {
            tenantId: 'tenant-del',
            userId: 'user-del',
            action: 'DELETE',
            entityType: 'Supplier',
            entityId: 'supplier-77',
            changes: Prisma.JsonNull,
          },
        });
        done();
      });
    });
  });

  it('should not write audit log when userId is missing', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('Supplier');

    const context = createMockExecutionContext({
      method: 'POST',
      user: {},
      tenantId: 'tenant-456',
    });
    const handler = createMockCallHandler({ id: 'new-1' });

    interceptor.intercept(context, handler).subscribe(() => {
      setImmediate(() => {
        expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
        done();
      });
    });
  });

  it('should not write audit log when tenantId is missing', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('Supplier');

    const context = createMockExecutionContext({
      method: 'POST',
      user: { sub: 'user-123' },
      tenantId: undefined,
    });
    const handler = createMockCallHandler({ id: 'new-1' });

    interceptor.intercept(context, handler).subscribe(() => {
      setImmediate(() => {
        expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
        done();
      });
    });
  });

  it('should not throw if audit log write fails', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('Supplier');
    mockPrismaService.auditLog.create.mockRejectedValue(new Error('DB error'));

    const context = createMockExecutionContext({
      method: 'POST',
      body: { razaoSocial: 'Test' },
      user: { sub: 'user-123' },
      tenantId: 'tenant-456',
    });
    const handler = createMockCallHandler({ id: 'new-1' });

    interceptor.intercept(context, handler).subscribe({
      next: (value) => {
        expect(value).toEqual({ id: 'new-1' });
        done();
      },
      error: () => {
        done.fail('Should not throw when audit log write fails');
      },
    });
  });

  it('should use "unknown" as entityId when it cannot be extracted', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('Supplier');

    const context = createMockExecutionContext({
      method: 'POST',
      body: { razaoSocial: 'Test' },
      params: {},
      user: { sub: 'user-123' },
      tenantId: 'tenant-456',
    });
    // Response has no id field
    const handler = createMockCallHandler({ success: true });

    interceptor.intercept(context, handler).subscribe(() => {
      setImmediate(() => {
        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              entityId: 'unknown',
            }),
          }),
        );
        done();
      });
    });
  });
});
