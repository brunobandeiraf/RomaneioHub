import { BadRequestException } from '@nestjs/common';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrderStatus } from '@compras-hub/shared';

export class QueryDashboardDto {
  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /**
   * Validates and returns the date range for dashboard queries.
   * Defaults to the last 30 days if no dates are provided.
   */
  validateDateRange(): { startDate: Date; endDate: Date } {
    const endDate = this.dateTo ? new Date(this.dateTo) : new Date();
    const startDate = this.dateFrom
      ? new Date(this.dateFrom)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (startDate > endDate) {
      throw new BadRequestException('dateFrom must be before dateTo');
    }

    return { startDate, endDate };
  }
}
