import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { TenantContext } from './tenant-context';

describe('PrismaService', () => {
  let service: PrismaService;
  let tenantContext: TenantContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantContext, PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
    tenantContext = module.get<TenantContext>(TenantContext);
  });

  afterEach(async () => {
    // Disconnect after each test to clean up
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have TenantContext injected', () => {
    expect(tenantContext).toBeDefined();
  });

  it('should expose an extended client with tenant extension', () => {
    const extended = service.extended;
    expect(extended).toBeDefined();
    // The extended client should be cached (same reference)
    expect(service.extended).toBe(extended);
  });

  it('should implement OnModuleInit lifecycle', () => {
    expect(service.onModuleInit).toBeDefined();
    expect(typeof service.onModuleInit).toBe('function');
  });

  it('should implement OnModuleDestroy lifecycle', () => {
    expect(service.onModuleDestroy).toBeDefined();
    expect(typeof service.onModuleDestroy).toBe('function');
  });
});
