import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantRole } from '@romaneio-hub/shared';
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
   * Direct file upload — accepts multipart/form-data.
   * Uploads the file to S3 and registers the invoice in one step.
   * Used in development (avoids CORS issues with presigned URLs).
   */
  @Post('upload')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadFile(
    @Param('id') orderId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('category') category: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não permitido. Use PDF, PNG ou JPG.');
    }

    return this.invoicesService.uploadDirect(
      orderId,
      file,
      (category as any) || 'PURCHASE',
      user.authId,
    );
  }

  /**
   * Register an invoice record after successful upload.
   */
  @Post()
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async registerInvoice(
    @Param('id') orderId: string,
    @Body() dto: RegisterInvoiceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invoicesService.registerInvoice(orderId, dto, user.authId);
  }

  /**
   * List all invoices for an order.
   */
  @Get()
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async listInvoices(@Param('id') orderId: string) {
    return this.invoicesService.listByOrder(orderId);
  }

  /**
   * View/stream an invoice file directly (proxy through backend).
   * Opens the file inline in the browser.
   */
  @Get(':invoiceId/view')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async viewFile(
    @Param('id') orderId: string,
    @Param('invoiceId') invoiceId: string,
    @Query('_') _cacheBuster: string,
    @Res() res: any,
  ) {
    const { signedUrl } = await this.invoicesService.getFileStream(orderId, invoiceId);
    res.redirect(signedUrl);
  }

  /**
   * Generate a presigned download URL for an invoice.
   */
  @Get(':invoiceId/download')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER)
  async getDownloadUrl(
    @Param('id') orderId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoicesService.generateDownloadUrl(orderId, invoiceId);
  }

  /**
   * Delete an invoice.
   */
  @Delete(':invoiceId')
  @Roles(TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER)
  async deleteInvoice(
    @Param('id') orderId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoicesService.deleteInvoice(orderId, invoiceId);
  }
}
