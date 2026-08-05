import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { TenantRole } from '@compras-hub/shared';
import { Roles, CurrentUser } from '../../common/decorators';
import { RequestUser } from '../../common/interfaces';
import { InvoicesService } from './invoices.service';
import { UploadUrlRequestDto } from './dto/upload-url-request.dto';
import { RegisterInvoiceDto } from './dto/register-invoice.dto';

@Controller('orders/:id/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * Generate a presigned upload URL for an invoice file.
   * Validates content type (PDF, PNG, JPG, JPEG) and size (≤10MB).
   * Returns presigned PUT URL valid for 15 minutes.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Post('upload-url')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async getUploadUrl(
    @Param('id') orderId: string,
    @Body() dto: UploadUrlRequestDto,
  ) {
    return this.invoicesService.generateUploadUrl(
      orderId,
      dto.filename,
      dto.contentType,
      dto.sizeBytes,
    );
  }

  /**
   * Register an invoice record after successful upload.
   * Roles: SELLER, ACCOUNTING_MANAGER
   */
  @Post()
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async registerInvoice(
    @Param('id') orderId: string,
    @Body() dto: RegisterInvoiceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invoicesService.registerInvoice(orderId, dto, user.userId);
  }

  /**
   * List all invoices for an order.
   * Roles: SELLER, ACCOUNTING_MANAGER, ACCOUNTING_VIEWER
   */
  @Get()
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async listInvoices(@Param('id') orderId: string) {
    return this.invoicesService.listByOrder(orderId);
  }

  /**
   * Generate a presigned download URL for an invoice.
   * Roles: SELLER, ACCOUNTING_MANAGER, ACCOUNTING_VIEWER
   */
  @Get(':invoiceId/download')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async getDownloadUrl(
    @Param('id') orderId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoicesService.generateDownloadUrl(orderId, invoiceId);
  }
}
