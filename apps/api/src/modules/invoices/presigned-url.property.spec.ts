import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../prisma/tenant-context';
import { S3Service } from './s3.service';

/**
 * Property 8: Presigned URL Security
 *
 * For any generated presigned URL, the S3 key follows the pattern
 * notas-fiscais/{tenant_id}/{pedido_id}/{filename} where tenant_id
 * matches the requesting user's tenant.
 *
 * **Validates: Requirements 7.1, 7.2**
 */
describe('Property 8: Presigned URL Security', () => {
  let service: InvoicesService;
  let currentTenantId: string;

  const mockTenantContext = {
    getTenantId: jest.fn(() => currentTenantId),
  };

  const mockPrismaService = {
    extended: {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-1',
          tenantId: 'tenant-1',
          _count: { invoices: 0 },
        }),
      },
    },
    invoice: {
      findMany: jest.fn(),
    },
  };

  const mockS3Service = {
    generatePresignedPutUrl: jest
      .fn()
      .mockResolvedValue('https://s3.amazonaws.com/bucket/presigned-url'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TenantContext, useValue: mockTenantContext },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    jest.clearAllMocks();

    // Re-apply default mock behaviors after clearAllMocks
    mockTenantContext.getTenantId.mockImplementation(() => currentTenantId);
    mockPrismaService.extended.order.findFirst.mockResolvedValue({
      id: 'order-1',
      tenantId: 'tenant-1',
      _count: { invoices: 0 },
    });
    mockS3Service.generatePresignedPutUrl.mockResolvedValue(
      'https://s3.amazonaws.com/bucket/presigned-url',
    );
  });

  // Arbitraries
  const tenantIdArb = fc.uuid();
  const orderIdArb = fc.uuid();
  const filenameArb = fc
    .tuple(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
        minLength: 1,
        maxLength: 20,
      }),
      fc.constantFrom('.pdf', '.png', '.jpg', '.jpeg'),
    )
    .map(([name, ext]) => `${name}${ext}`);

  it('S3 key follows the pattern notas-fiscais/{tenant_id}/{order_id}/{filename}', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        orderIdArb,
        filenameArb,
        async (tenantId, orderId, filename) => {
          currentTenantId = tenantId;

          const result = await service.generateUploadUrl(
            orderId,
            filename,
            'application/pdf',
            1024,
          );

          const expectedKey = `notas-fiscais/${tenantId}/${orderId}/${filename}`;
          expect(result.s3Key).toBe(expectedKey);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('tenant_id in the S3 key always matches the TenantContext tenant', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        orderIdArb,
        filenameArb,
        async (tenantId, orderId, filename) => {
          currentTenantId = tenantId;

          const result = await service.generateUploadUrl(
            orderId,
            filename,
            'application/pdf',
            2048,
          );

          // Extract tenant_id from the S3 key
          const keyParts = result.s3Key.split('/');
          const tenantIdInKey = keyParts[1];

          expect(tenantIdInKey).toBe(tenantId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('S3 key never contains path traversal sequences (..)', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        orderIdArb,
        filenameArb,
        async (tenantId, orderId, filename) => {
          currentTenantId = tenantId;

          const result = await service.generateUploadUrl(
            orderId,
            filename,
            'application/pdf',
            512,
          );

          expect(result.s3Key).not.toContain('..');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('S3 key never contains another tenant ID when a different tenant makes the request', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        tenantIdArb,
        orderIdArb,
        filenameArb,
        async (tenantId, otherTenantId, orderId, filename) => {
          // Only test when tenant IDs are actually different
          fc.pre(tenantId !== otherTenantId);

          currentTenantId = tenantId;

          const result = await service.generateUploadUrl(
            orderId,
            filename,
            'application/pdf',
            4096,
          );

          // The key should contain the requesting tenant's ID, not the other tenant's
          const keyParts = result.s3Key.split('/');
          const tenantIdInKey = keyParts[1];

          expect(tenantIdInKey).toBe(tenantId);
          expect(tenantIdInKey).not.toBe(otherTenantId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('S3 key has exactly 4 segments: prefix/tenantId/orderId/filename', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        orderIdArb,
        filenameArb,
        async (tenantId, orderId, filename) => {
          currentTenantId = tenantId;

          const result = await service.generateUploadUrl(
            orderId,
            filename,
            'image/png',
            8192,
          );

          const keyParts = result.s3Key.split('/');
          expect(keyParts).toHaveLength(4);
          expect(keyParts[0]).toBe('notas-fiscais');
          expect(keyParts[1]).toBe(tenantId);
          expect(keyParts[2]).toBe(orderId);
          expect(keyParts[3]).toBe(filename);
        },
      ),
      { numRuns: 100 },
    );
  });
});
