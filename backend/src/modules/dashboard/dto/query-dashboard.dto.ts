import { BadRequestException } from '@nestjs/common';
import {
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { OrderStatus } from '../../../shared/index';

export enum DashboardPeriod {
  CURRENT_MONTH = 'current_month',
  PREVIOUS_MONTH = 'previous_month',
  LAST_3_MONTHS = 'last_3_months',
  CUSTOM = 'custom',
}

export class QueryDashboardDto {
  @IsOptional()
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
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

  /**
   * Resolves the period enum (or custom range) into concrete start/end dates.
   * Validates:
   * - startDate ≤ endDate
   * - Custom range does not exceed 365 days
   * Defaults to current_month if no period is specified.
   */
  validateDateRange(): { startDate: Date; endDate: Date } {
    return calculateDateRange(this.period, this.startDate, this.endDate);
  }
}

/**
 * Calculate concrete date range from a period enum and optional custom dates.
 * Exported for reuse and testability.
 */
export function calculateDateRange(
  period?: DashboardPeriod,
  startDateStr?: string,
  endDateStr?: string,
): { startDate: Date; endDate: Date } {
  const resolvedPeriod = period ?? DashboardPeriod.CURRENT_MONTH;

  switch (resolvedPeriod) {
    case DashboardPeriod.CURRENT_MONTH: {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      return { startDate, endDate };
    }

    case DashboardPeriod.PREVIOUS_MONTH: {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );
      return { startDate, endDate };
    }

    case DashboardPeriod.LAST_3_MONTHS: {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      return { startDate, endDate };
    }

    case DashboardPeriod.CUSTOM: {
      if (!startDateStr || !endDateStr) {
        throw new BadRequestException(
          'startDate and endDate are required when period is custom',
        );
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      if (startDate > endDate) {
        throw new BadRequestException('startDate must be before or equal to endDate');
      }

      const diffMs = endDate.getTime() - startDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 365) {
        throw new BadRequestException(
          'Custom date range cannot exceed 365 days',
        );
      }

      return { startDate, endDate };
    }

    default:
      throw new BadRequestException(`Invalid period: ${resolvedPeriod}`);
  }
}
