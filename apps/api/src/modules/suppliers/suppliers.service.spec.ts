import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../../prisma/prisma.service';

// Valid CNPJ for testing (11.222.333/0001-81)
const VALID_CNPJ = '11222333000181';
const VALID_CNPJ_2 = '11444777000161';

const mockSupplier = {
  id: 'supplier-1',
  tenantId: 'tenant-1',
  razaoSocial: 'Fornecedor Teste LTDA',
  nomeFantasia: 'Fornecedor Teste',
  cnpj: VALID_CNPJ,
  contato: 'contato@teste.com',
  endereco: { rua: 'Rua Teste', numero: '123' },
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdById: 'user-1',
  updatedById: 'user-1',
};

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: any;

  const mockPrismaExtended = {
    supplier: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockPrismaService = {
    extended: mockPrismaExtended,
    order: {
      count: jest.fn(),
    },
    productSupplier: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
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
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return paginated suppliers', async () => {
      const suppliers = [mockSupplier];
      mockPrismaExtended.supplier.findMany.mockResolvedValue(suppliers);
      mockPrismaExtended.supplier.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, limit: 20 });

      expect(result.data).toEqual(suppliers);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(mockPrismaExtended.supplier.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by search term (razaoSocial/cnpj)', async () => {
      mockPrismaExtended.supplier.findMany.mockResolvedValue([]);
      mockPrismaExtended.supplier.count.mockResolvedValue(0);

      await service.list({ search: 'teste' });

      expect(mockPrismaExtended.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { razaoSocial: { contains: 'teste', mode: 'insensitive' } },
              { cnpj: { contains: 'teste', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should filter by active status', async () => {
      mockPrismaExtended.supplier.findMany.mockResolvedValue([]);
      mockPrismaExtended.supplier.count.mockResolvedValue(0);

      await service.list({ active: true });

      expect(mockPrismaExtended.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true },
        }),
      );
    });

    it('should use default pagination values', async () => {
      mockPrismaExtended.supplier.findMany.mockResolvedValue([]);
      mockPrismaExtended.supplier.count.mockResolvedValue(0);

      const result = await service.list({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(mockPrismaExtended.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a supplier by id', async () => {
      mockPrismaExtended.supplier.findFirst.mockResolvedValue(mockSupplier);

      const result = await service.findOne('supplier-1');

      expect(result).toEqual(mockSupplier);
      expect(mockPrismaExtended.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 'supplier-1' },
      });
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockPrismaExtended.supplier.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a supplier with valid CNPJ', async () => {
      mockPrismaExtended.supplier.findFirst.mockResolvedValue(null);
      mockPrismaExtended.supplier.create.mockResolvedValue(mockSupplier);

      const dto = {
        razaoSocial: 'Fornecedor Teste LTDA',
        nomeFantasia: 'Fornecedor Teste',
        cnpj: VALID_CNPJ,
        contato: 'contato@teste.com',
        endereco: { rua: 'Rua Teste', numero: '123' },
      };

      const result = await service.create(dto, 'user-1');

      expect(result).toEqual(mockSupplier);
      expect(mockPrismaExtended.supplier.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          razaoSocial: 'Fornecedor Teste LTDA',
          cnpj: VALID_CNPJ,
          createdById: 'user-1',
          updatedById: 'user-1',
        }),
      });
    });

    it('should throw BadRequestException for invalid CNPJ', async () => {
      const dto = {
        razaoSocial: 'Fornecedor Teste LTDA',
        cnpj: '12345678901234', // invalid check digits
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException for duplicate CNPJ in same tenant', async () => {
      mockPrismaExtended.supplier.findFirst.mockResolvedValue(mockSupplier);

      const dto = {
        razaoSocial: 'Outro Fornecedor',
        cnpj: VALID_CNPJ,
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should store CNPJ without formatting characters', async () => {
      mockPrismaExtended.supplier.findFirst.mockResolvedValue(null);
      mockPrismaExtended.supplier.create.mockResolvedValue(mockSupplier);

      const dto = {
        razaoSocial: 'Fornecedor Teste LTDA',
        cnpj: '11.222.333/0001-81',
      };

      await service.create(dto, 'user-1');

      expect(mockPrismaExtended.supplier.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cnpj: VALID_CNPJ,
        }),
      });
    });
  });

  describe('update', () => {
    it('should update a supplier', async () => {
      mockPrismaExtended.supplier.findFirst.mockResolvedValue(mockSupplier);
      mockPrismaExtended.supplier.update.mockResolvedValue({
        ...mockSupplier,
        razaoSocial: 'Novo Nome',
      });

      const result = await service.update(
        'supplier-1',
        { razaoSocial: 'Novo Nome' },
        'user-2',
      );

      expect(result.razaoSocial).toBe('Novo Nome');
      expect(mockPrismaExtended.supplier.update).toHaveBeenCalledWith({
        where: { id: 'supplier-1' },
        data: expect.objectContaining({
          razaoSocial: 'Novo Nome',
          updatedById: 'user-2',
        }),
      });
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockPrismaExtended.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { razaoSocial: 'Test' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating CNPJ to an existing one', async () => {
      // First call: finding the supplier being updated
      mockPrismaExtended.supplier.findFirst
        .mockResolvedValueOnce(mockSupplier)
        // Second call: checking for duplicate CNPJ
        .mockResolvedValueOnce({ ...mockSupplier, id: 'supplier-2' });

      await expect(
        service.update('supplier-1', { cnpj: VALID_CNPJ_2 }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow updating CNPJ to the same value (no conflict with itself)', async () => {
      mockPrismaExtended.supplier.findFirst
        .mockResolvedValueOnce(mockSupplier)
        // Second call: no other supplier with same CNPJ
        .mockResolvedValueOnce(null);
      mockPrismaExtended.supplier.update.mockResolvedValue(mockSupplier);

      const result = await service.update(
        'supplier-1',
        { cnpj: VALID_CNPJ },
        'user-1',
      );

      expect(result).toEqual(mockSupplier);
    });
  });

  describe('remove', () => {
    it('should soft-delete when supplier has linked orders', async () => {
      mockPrismaExtended.supplier.findFirst.mockResolvedValue(mockSupplier);
      mockPrismaService.order.count.mockResolvedValue(3);
      mockPrismaExtended.supplier.update.mockResolvedValue({
        ...mockSupplier,
        active: false,
      });

      const result = await service.remove('supplier-1');

      expect(result.active).toBe(false);
      expect(mockPrismaExtended.supplier.update).toHaveBeenCalledWith({
        where: { id: 'supplier-1' },
        data: { active: false },
      });
      expect(mockPrismaExtended.supplier.delete).not.toHaveBeenCalled();
    });

    it('should hard-delete when supplier has no linked orders', async () => {
      mockPrismaExtended.supplier.findFirst.mockResolvedValue(mockSupplier);
      mockPrismaService.order.count.mockResolvedValue(0);
      mockPrismaService.productSupplier.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaExtended.supplier.delete.mockResolvedValue(mockSupplier);

      await service.remove('supplier-1');

      expect(mockPrismaService.productSupplier.deleteMany).toHaveBeenCalledWith({
        where: { supplierId: 'supplier-1' },
      });
      expect(mockPrismaExtended.supplier.delete).toHaveBeenCalledWith({
        where: { id: 'supplier-1' },
      });
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockPrismaExtended.supplier.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
