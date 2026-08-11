import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantContext } from '../../prisma/tenant-context';

describe('TenantContextInterceptor', () => {
  let interceptor: TenantContextInterceptor;
  let tenantContext: TenantContext;

  beforeEach(() => {
    tenantContext = new TenantContext();
    interceptor = new TenantContextInterceptor(tenantContext);
  });

  function createMockContext(tenantId?: string | null): ExecutionContext {
    const request = { tenantId } as any;
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  function createMockHandler(callback?: () => any): CallHandler {
    return {
      handle: () => of(callback ? callback() : 'response'),
    };
  }

  it('should wrap handler in tenant context when tenantId is present', async () => {
    let capturedTenantId: string | undefined;

    const context = createMockContext('tenant-123');

    // Use a custom handler that captures the context during execution
    const customHandler: CallHandler = {
      handle: () => {
        capturedTenantId = tenantContext.getTenantId();
        return of('result');
      },
    };

    const result$ = interceptor.intercept(context, customHandler);
    const result = await lastValueFrom(result$);

    expect(result).toBe('result');
    expect(capturedTenantId).toBe('tenant-123');
  });

  it('should pass through without tenant context when tenantId is null', async () => {
    const context = createMockContext(null);
    const handler = createMockHandler();

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toBe('response');
    // Outside tenant context, tenantId should be undefined
    expect(tenantContext.getTenantId()).toBeUndefined();
  });

  it('should pass through without tenant context when tenantId is undefined', async () => {
    const context = createMockContext(undefined);
    const handler = createMockHandler();

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toBe('response');
    expect(tenantContext.getTenantId()).toBeUndefined();
  });

  it('should propagate errors from the handler', async () => {
    const context = createMockContext('tenant-123');
    const error = new Error('Handler error');

    const handler: CallHandler = {
      handle: () => {
        throw error;
      },
    };

    // When the handler throws synchronously during subscribe,
    // the observable should error
    const result$ = interceptor.intercept(context, handler);

    await expect(lastValueFrom(result$)).rejects.toThrow('Handler error');
  });

  it('should isolate tenant contexts between requests', async () => {
    const capturedIds: (string | undefined)[] = [];

    const context1 = createMockContext('tenant-aaa');
    const context2 = createMockContext('tenant-bbb');

    const handler1: CallHandler = {
      handle: () => {
        capturedIds.push(tenantContext.getTenantId());
        return of('result-1');
      },
    };

    const handler2: CallHandler = {
      handle: () => {
        capturedIds.push(tenantContext.getTenantId());
        return of('result-2');
      },
    };

    const result1$ = interceptor.intercept(context1, handler1);
    const result2$ = interceptor.intercept(context2, handler2);

    await lastValueFrom(result1$);
    await lastValueFrom(result2$);

    expect(capturedIds).toEqual(['tenant-aaa', 'tenant-bbb']);
  });
});
