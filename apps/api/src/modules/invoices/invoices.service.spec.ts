import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ALLOWED_INVOICE_CONTENT_TYPES,
  MAX_INVOICE_FILE_SIZE,
  MAX_INVOICES_PER_ORDER,
  PRESIGNED_URL_EXPIRY_SECONDS,
} from '@compras-hub/shared';
import { InvoicesService } from './invoices.service';
import { S3Service } from './s3.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../prisma/tenant-context';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let s3Service: jest.Mocked<S3Service>;
  let prismaService: any;
  let tenantContext: jest.Mocked<TenantContext>;

  const mockTenantId = 'tenant-123';
  const mockOrderId = 'order-456';
  const mockUserId = 'user-789';

  beforeEach(async () => {
    const mockPrisma = {
      extended: {
        order: {
          findFirst: jest.fn(),
        },
      },
      invoice: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const mockS3Service = {
      generatePresignedPutUrl: jest.fn(),
      generatePresignedGetUrl: jest.fn(),
    };

    const mockTenantContext = {
      getTenantId: jest.fn().mockReturnValue(mockTenantId),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3Service },
        { provide: TenantContext, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    s3Service = module.get(S3Service);
    prismaService = module.get(PrismaService);
    tenantContext = module.get(TenantContext);
  });

  describe('generateUploadUrl', () => {
    it('should generate a presigned PUT URL for a valid request', async () => {
      const mockUrl = 'https://s3.amazonaws.com/presigned-put-url';
      prismaService.extended.order.findFirst.mockResolvedValue({
        id: mockOrderId,
        _count: { invoices: 3 },
      });
      s3Service.generatePresignedPutUrl.mockResolvedValue(mockUrl);

      const result = await service.generateUploadUrl(
        mockOrderId,
        'invoice.pdf',
        'application/pdf',
        1024 * 1024,
      );

      expect(result.url).toBe(mockUrl);
      expect(result.s3Key).toBe(
        `notas-fiscais/${mockTenantId}/${mockOrderId}/invoice.pdf`,
      );
      expect(result.expiresIn).toBe(PRESIGNED_URL_EXPIRY_SECONDS);
      expect(s3Service.generatePresignedPutUrl).toHaveBeenCalledWith(
        `notas-fiscais/${mockTenantId}/${mockOrderId}/invoice.pdf`,
        'application/pdf',
        PRESIGNED_URL_EXPIRY_SECONDS,
      );
    });

    it('should throw BadRequestException for invalid content type', async () => {
      await expect(
        service.generateUploadUrl(
          mockOrderId,
          'file.txt',
          'text/plain',
          1024,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for file exceeding max size', async () => {
      await expect(
        service.generateUploadUrl(
          mockOrderId,
          'big.pdf',
          'application/pdf',
          MAX_INVOICE_FILE_SIZE + 1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if order does not exist', async () => {
      prismaService.extended.order.findFirst.mockResolvedValue(null);

      await expect(
        service.generateUploadUrl(
          mockOrderId,
          'invoice.pdf',
          'application/pdf',
          1024,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when max invoices per order reached', async () => {
      prismaService.extended.order.findFirst.mockResolvedValue({
        id: mockOrderId,
        _count: { invoices: MAX_INVOICES_PER_ORDER },
      });

      await expect(
        service.generateUploadUrl(
          mockOrderId,
          'invoice.pdf',
          'application/pdf',
          1024,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept all valid content types', async () => {
      prismaService.extended.order.findFirst.mockResolvedValue({
        id: mockOrderId,
        _count: { invoices: 0 },
      });
      s3Service.generatePresignedPutUrl.mockResolvedValue('https://url');

      for (const contentType of ALLOWED_INVOICE_CONTENT_TYPES) {
        const result = await service.generateUploadUrl(
          mockOrderId,
          'file',
          contentType,
          1024,
        );
        expect(result.url).toBe('https://url');
      }
    });
  });

  describe('registerInvoice', () => {
    const dto = {
      filename: 'invoice.pdf',
      s3Key: `notas-fiscais/${mockTenantId}/${mockOrderId}/invoice.pdf`,
      contentType: 'application/pdf',
      sizeBytes: 2048,
    };

    it('should create an invoice record', async () => {
      prismaService.extended.order.findFirst.mockResolvedValue({
        id: mockOrderId,
        _count: { invoices: 2 },
      });
      const mockInvoice = { id: 'inv-1', ...dto, orderId: mockOrderId, uploadedById: mockUserId };
      prismaService.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.registerInvoice(mockOrderId, dto, mockUserId);

      expect(result).toEqual(mockInvoice);
      expect(prismaService.invoice.create).toHaveBeenCalledWith({
        data: {
          orderId: mockOrderId,
          filename: dto.filename,
          s3Key: dto.s3Key,
          contentType: dto.contentType,
          sizeBytes: dto.sizeBytes,
          uploadedById: mockUserId,
        },
      });
    });

    it('should throw NotFoundException if order does not exist', async () => {
      prismaService.extended.order.findFirst.mockResolvedValue(null);

      await expect(
        service.registerInvoice(mockOrderId, dto, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when max invoices per order reached', async () => {
      prismaService.extended.order.findFirst.mockResolvedValue({
        id: mockOrderId,
        _count: { invoices: MAX_INVOICES_PER_ORDER },
      });

      await expect(
        service.registerInvoice(mockOrderId, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listByOrder', () => {
    it('should return invoices for a valid order', async () => {
      prismaService.extended.order.findFirst.mockResolvedValue({
        id: mockOrderId,
      });
      const mockInvoices = [
        { id: 'inv-1', filename: 'a.pdf', orderId: mockOrderId },
        { id: 'inv-2', filename: 'b.png', orderId: mockOrderId },
      ];
      prismaService.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await service.listByOrder(mockOrderId);

      expect(result).toEqual(mockInvoices);
      expect(prismaService.invoice.findMany).toHaveBeenCalledWith({
        where: { orderId: mockOrderId },
        orderBy: { uploadedAt: 'desc' },
      });
    });

    it('should throw NotFoundException if order does not exist', async () => {
      prismaService.extended.order.findFirst.mockResolvedValue(null);

      await expect(service.listByOrder(mockOrderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generateDownloadUrl', () => {
    it('should generate a presigned GET URL for a valid invoice', async () => {
      const mockInvoice = {
        id: 'inv-1',
        orderId: mockOrderId,
        filename: 'invoice.pdf',
        s3Key: `notas-fiscais/${mockTenantId}/${mockOrderId}/invoice.pdf`,
      };
      prismaService.extended.order.findFirst.mockResolvedValue({
        id: mockOrderId,
      });
      prismaService.invoice.findFirst.mockResolvedValue(mockInvoice);
      s3Service.generatePresignedGetUrl.mockResolvedValue(
        'https://s3.amazonaws.com/presigned-get-url',
      );

      const result = await service.generateDownloadUrl(mockOrderId, 'inv-1');

      expect(result.url).toBe('https://s3.amazonaws.com/presigned-get-url');
      expect(result.filename).toBe('invoice.pdf');
      expect(result.expiresIn).toBe(PRESIGNED_URL_EXPIRY_SECONDS);
      expect(s3Service.generatePresignedGetUrl).toHaveBeenCalledWith(
        mockInvoice.s3Key,
        PRESIGNED_URL_EXPIRY_SECONDS,
      );
    });

    it('should throw NotFoundException if order does not exist', async () => {
      prismaService.extended.order.findFirst.mockResolvedValue(null);

      await expect(
        service.generateDownloadUrl(mockOrderId, 'inv-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if invoice does not exist', async () => {
      prismaService.extended.order.findFirst.mockResolvedValue({
        id: mockOrderId,
      });
      prismaService.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.generateDownloadUrl(mockOrderId, 'inv-999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
