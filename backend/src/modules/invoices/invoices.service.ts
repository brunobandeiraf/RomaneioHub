import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ALLOWED_INVOICE_CONTENT_TYPES,
  INVOICE_STORAGE_KEY_PREFIX,
  MAX_INVOICE_FILE_SIZE,
  MAX_INVOICES_PER_ORDER,
  PRESIGNED_URL_EXPIRY_SECONDS,
} from '../../shared/index';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../prisma/tenant-context';
import { SupabaseStorageService, StorageUploadUrlError } from './supabase-storage.service';
import { RegisterInvoiceDto } from './dto/register-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    private readonly storageService: SupabaseStorageService,
  ) {}

  /**
   * Generates a presigned PUT URL for uploading an invoice to Supabase Storage.
   * Validates content type, file size, order existence, and max invoice limit.
   */
  async generateUploadUrl(
    orderId: string,
    filename: string,
    contentType: string,
    sizeBytes: number,
  ) {
    // Validate content type
    if (
      !ALLOWED_INVOICE_CONTENT_TYPES.includes(
        contentType as (typeof ALLOWED_INVOICE_CONTENT_TYPES)[number],
      )
    ) {
      throw new BadRequestException(
        `Invalid content type. Allowed types: ${ALLOWED_INVOICE_CONTENT_TYPES.join(', ')}`,
      );
    }

    // Validate file size
    if (sizeBytes > MAX_INVOICE_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${MAX_INVOICE_FILE_SIZE} bytes (10 MB)`,
      );
    }

    // Verify order exists within tenant scope
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
      include: { _count: { select: { invoices: true } } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check max invoices per order
    if (order._count.invoices >= MAX_INVOICES_PER_ORDER) {
      throw new BadRequestException(
        `Maximum of ${MAX_INVOICES_PER_ORDER} invoices per order reached`,
      );
    }

    const tenantId = this.tenantContext.getTenantId();
    const storageKey = `${INVOICE_STORAGE_KEY_PREFIX}/${tenantId}/${orderId}/${filename}`;

    const url = await this.storageService.createSignedUploadUrl(storageKey);

    return { url, storageKey, expiresIn: PRESIGNED_URL_EXPIRY_SECONDS };
  }

  /**
   * Register an Invoice record after successful upload.
   * Validates order existence and max invoice limit.
   */
  async registerInvoice(
    orderId: string,
    dto: RegisterInvoiceDto,
    userId: string,
  ) {
    // Verify order exists within tenant scope
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
      include: { _count: { select: { invoices: true } } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check max invoices per order
    if (order._count.invoices >= MAX_INVOICES_PER_ORDER) {
      throw new BadRequestException(
        `Maximum of ${MAX_INVOICES_PER_ORDER} invoices per order reached`,
      );
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        orderId,
        filename: dto.filename,
        storageKey: dto.storageKey,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        uploadedById: userId,
        category: (dto.category || 'PURCHASE') as any,
      },
    });

    return invoice;
  }

  /**
   * List all invoices for a given order.
   */
  async listByOrder(orderId: string) {
    // Verify order exists within tenant scope
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.prisma.invoice.findMany({
      where: { orderId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  /**
   * Generate a presigned GET URL for downloading an invoice.
   */
  async generateDownloadUrl(orderId: string, invoiceId: string) {
    // Verify order exists within tenant scope
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, orderId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const url = await this.storageService.createSignedUrl(
      invoice.storageKey,
      PRESIGNED_URL_EXPIRY_SECONDS,
    );

    return { url, filename: invoice.filename, expiresIn: PRESIGNED_URL_EXPIRY_SECONDS };
  }

  /**
   * Upload a file directly through the backend and register the invoice.
   * In Supabase, the actual upload is done client-side via signed URL.
   * This method generates a signed upload URL and registers the invoice record.
   * If a file with the same name and category already exists, it will be replaced.
   */
  async uploadDirect(
    orderId: string,
    file: Express.Multer.File,
    category: string,
    userId: string,
  ) {
    // Verify order exists within tenant scope
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
      include: { _count: { select: { invoices: true } } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const tenantId = this.tenantContext.getTenantId();
    const storageKey = `${INVOICE_STORAGE_KEY_PREFIX}/${tenantId}/${orderId}/${file.originalname}`;

    // Check if file with same name + category already exists — replace it
    const existing = await this.prisma.invoice.findFirst({
      where: {
        orderId,
        filename: file.originalname,
        category: category as any,
      },
    });

    if (existing) {
      // Delete old record (storage object will be overwritten via signed URL)
      await this.prisma.invoice.delete({ where: { id: existing.id } });
    } else {
      // Check max limit only for new files
      if (order._count.invoices >= MAX_INVOICES_PER_ORDER) {
        throw new BadRequestException(
          `Máximo de ${MAX_INVOICES_PER_ORDER} arquivos por pedido`,
        );
      }
    }

    // Register in database (client uploads directly to Supabase Storage via signed URL)
    const invoice = await this.prisma.invoice.create({
      data: {
        orderId,
        filename: file.originalname,
        storageKey,
        storageUrl: null,
        contentType: file.mimetype,
        sizeBytes: file.size,
        uploadedById: userId,
        category: (category || 'PURCHASE') as any,
      },
    });

    return invoice;
  }

  /**
   * Get file access details for viewing in the browser.
   * Returns a signed URL instead of a stream (Supabase Storage does not support server-side streams).
   */
  async getFileStream(orderId: string, invoiceId: string) {
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, orderId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const signedUrl = await this.storageService.createSignedUrl(
      invoice.storageKey,
      PRESIGNED_URL_EXPIRY_SECONDS,
    );

    return {
      signedUrl,
      contentType: invoice.contentType,
      filename: invoice.filename,
    };
  }

  /**
   * Delete an invoice record and its storage file.
   */
  async deleteInvoice(orderId: string, invoiceId: string) {
    // Verify order exists within tenant scope
    const order = await this.prisma.extended.order.findFirst({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, orderId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Delete from Supabase Storage
    await this.storageService.remove(invoice.storageKey);

    // Delete from database
    await this.prisma.invoice.delete({ where: { id: invoiceId } });

    return { deleted: true };
  }
}
