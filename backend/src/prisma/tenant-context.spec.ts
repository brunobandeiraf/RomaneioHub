import { TenantContext } from './tenant-context';

describe('TenantContext', () => {
  let tenantContext: TenantContext;

  beforeEach(() => {
    tenantContext = new TenantContext();
  });

  it('should return undefined when no context is set', () => {
    expect(tenantContext.getTenantId()).toBeUndefined();
  });

  it('should return the tenantId within a run() callback', () => {
    tenantContext.run('tenant-123', () => {
      expect(tenantContext.getTenantId()).toBe('tenant-123');
    });
  });

  it('should return undefined outside of run() callback', () => {
    tenantContext.run('tenant-123', () => {
      // inside: available
      expect(tenantContext.getTenantId()).toBe('tenant-123');
    });
    // outside: undefined
    expect(tenantContext.getTenantId()).toBeUndefined();
  });

  it('should support nested contexts with independent tenant IDs', () => {
    tenantContext.run('tenant-A', () => {
      expect(tenantContext.getTenantId()).toBe('tenant-A');

      tenantContext.run('tenant-B', () => {
        expect(tenantContext.getTenantId()).toBe('tenant-B');
      });

      // After inner context exits, outer context is restored
      expect(tenantContext.getTenantId()).toBe('tenant-A');
    });
  });

  it('should return value from callback in run()', () => {
    const result = tenantContext.run('tenant-123', () => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it('should support async callbacks', async () => {
    const result = await tenantContext.run('tenant-async', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return tenantContext.getTenantId();
    });
    expect(result).toBe('tenant-async');
  });
});
