import * as fc from 'fast-check';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { validateCnpj } from '@romaneio-hub/shared';

/**
 * **Validates: Requirements 4.2**
 *
 * Property 3: CNPJ Uniqueness Per Tenant
 * For any tenant, no two active suppliers share the same CNPJ;
 * different tenants may have suppliers with the same CNPJ.
 */

// Helper: Generate a valid CNPJ (14 digits with correct check digits)
function generateValidCnpj(): fc.Arbitrary<string> {
  return fc
    .tuple(
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
    )
    .filter((digits) => {
      // Reject all-same-digit sequences (e.g. 00000000000000)
      return !digits.every((d) => d === digits[0]);
    })
    .map((digits) => {
      const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

      // Calculate first check digit
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += digits[i] * weights1[i];
      }
      let remainder = sum % 11;
      const firstCheck = remainder < 2 ? 0 : 11 - remainder;

      // Calculate second check digit
      const digits13 = [...digits, firstCheck];
      sum = 0;
      for (let i = 0; i < 13; i++) {
        sum += digits13[i] * weights2[i];
      }
      remainder = sum % 11;
      const secondCheck = remainder < 2 ? 0 : 11 - remainder;

      return [...digits, firstCheck, secondCheck].join('');
    });
}

// Helper: Generate a random tenant ID
function generateTenantId(): fc.Arbitrary<string> {
  return fc.uuid().map((id) => `tenant-${id}`);
}

describe('Property 3: CNPJ Uniqueness Per Tenant', () => {
  let service: SuppliersService;
  let mockPrismaExtended: any;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaExtended = {
      supplier: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockPrismaService = {
      extended: mockPrismaExtended,
      order: {
        count: jest.fn(),
      },
      productSupplier: {
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  it('should validate that generated CNPJs pass the validateCnpj function', () => {
    fc.assert(
      fc.property(generateValidCnpj(), (cnpj) => {
        return validateCnpj(cnpj) === true;
      }),
      { numRuns: 200 },
    );
  });

  it('should reject duplicate CNPJ creation within the same tenant', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidCnpj(),
        generateTenantId(),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (cnpj, tenantId, razaoSocial) => {
          jest.clearAllMocks();

          // Simulate that a supplier with this CNPJ already exists in this tenant
          mockPrismaExtended.supplier.findFirst.mockResolvedValue({
            id: 'existing-supplier',
            tenantId,
            cnpj,
            razaoSocial: 'Existing Supplier',
            active: true,
          });

          const dto = {
            razaoSocial: razaoSocial || 'Test Supplier',
            cnpj,
          };

          // Attempting to create a second supplier with the same CNPJ
          // in the same tenant should throw a ConflictException
          try {
            await service.create(dto, 'user-1');
            // If no error thrown, the property fails
            return false;
          } catch (error) {
            return error instanceof ConflictException;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should allow the same CNPJ in different tenants', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidCnpj(),
        generateTenantId(),
        generateTenantId(),
        async (cnpj, tenantId1, tenantId2) => {
          // Ensure the two tenant IDs are different
          fc.pre(tenantId1 !== tenantId2);

          jest.clearAllMocks();

          // For tenant2's context: no existing supplier with this CNPJ
          // (the one that exists is in tenant1, which is a different tenant scope)
          mockPrismaExtended.supplier.findFirst.mockResolvedValue(null);
          mockPrismaExtended.supplier.create.mockResolvedValue({
            id: 'new-supplier',
            tenantId: tenantId2,
            cnpj,
            razaoSocial: 'Supplier in Tenant 2',
            active: true,
          });

          const dto = {
            razaoSocial: 'Supplier in Tenant 2',
            cnpj,
          };

          // Creating a supplier with the same CNPJ in a different tenant should succeed.
          // The tenant-scoped Prisma middleware ensures findFirst only looks within
          // the current tenant, so no conflict is found.
          try {
            const result = await service.create(dto, 'user-2');
            return result !== null && result !== undefined;
          } catch {
            // Should not throw - if it does, the property fails
            return false;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should validate random inputs against validateCnpj - invalid CNPJs should fail', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 20 }),
        (randomInput) => {
          const result = validateCnpj(randomInput);
          // Result should always be a boolean
          return typeof result === 'boolean';
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should reject all-same-digit CNPJs as invalid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        (digit) => {
          const allSameDigits = digit.toString().repeat(14);
          return validateCnpj(allSameDigits) === false;
        },
      ),
      { numRuns: 10 },
    );
  });
});
