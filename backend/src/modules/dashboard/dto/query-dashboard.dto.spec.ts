import { BadRequestException } from '@nestjs/common';
import {
  calculateDateRange,
  DashboardPeriod,
  QueryDashboardDto,
} from './query-dashboard.dto';

describe('calculateDateRange', () => {
  describe('CURRENT_MONTH', () => {
    it('should return first and last day of current month', () => {
      const { startDate, endDate } = calculateDateRange(
        DashboardPeriod.CURRENT_MONTH,
      );

      const now = new Date();
      expect(startDate.getFullYear()).toBe(now.getFullYear());
      expect(startDate.getMonth()).toBe(now.getMonth());
      expect(startDate.getDate()).toBe(1);

      expect(endDate.getFullYear()).toBe(now.getFullYear());
      expect(endDate.getMonth()).toBe(now.getMonth());
      // Last day of month
      const lastDay = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      expect(endDate.getDate()).toBe(lastDay);
    });
  });

  describe('PREVIOUS_MONTH', () => {
    it('should return first and last day of previous month', () => {
      const { startDate, endDate } = calculateDateRange(
        DashboardPeriod.PREVIOUS_MONTH,
      );

      const now = new Date();
      const expectedMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const expectedYear =
        now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      expect(startDate.getFullYear()).toBe(expectedYear);
      expect(startDate.getMonth()).toBe(expectedMonth);
      expect(startDate.getDate()).toBe(1);

      expect(endDate.getMonth()).toBe(expectedMonth);
      const lastDay = new Date(expectedYear, expectedMonth + 1, 0).getDate();
      expect(endDate.getDate()).toBe(lastDay);
    });
  });

  describe('LAST_3_MONTHS', () => {
    it('should return first day of 2 months ago to last day of current month', () => {
      const { startDate, endDate } = calculateDateRange(
        DashboardPeriod.LAST_3_MONTHS,
      );

      const now = new Date();
      const expectedStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      expect(startDate.getFullYear()).toBe(expectedStart.getFullYear());
      expect(startDate.getMonth()).toBe(expectedStart.getMonth());
      expect(startDate.getDate()).toBe(1);

      // End is last day of current month
      const lastDay = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      expect(endDate.getMonth()).toBe(now.getMonth());
      expect(endDate.getDate()).toBe(lastDay);
    });
  });

  describe('CUSTOM', () => {
    it('should return parsed start and end dates', () => {
      const { startDate, endDate } = calculateDateRange(
        DashboardPeriod.CUSTOM,
        '2024-03-01',
        '2024-03-31',
      );

      expect(startDate.toISOString()).toContain('2024-03-01');
      expect(endDate.toISOString()).toContain('2024-03-31');
    });

    it('should throw if startDate is missing', () => {
      expect(() =>
        calculateDateRange(DashboardPeriod.CUSTOM, undefined, '2024-03-31'),
      ).toThrow(BadRequestException);
    });

    it('should throw if endDate is missing', () => {
      expect(() =>
        calculateDateRange(DashboardPeriod.CUSTOM, '2024-03-01', undefined),
      ).toThrow(BadRequestException);
    });

    it('should throw if startDate > endDate', () => {
      expect(() =>
        calculateDateRange(DashboardPeriod.CUSTOM, '2024-04-01', '2024-03-01'),
      ).toThrow(BadRequestException);
    });

    it('should throw if range exceeds 365 days', () => {
      expect(() =>
        calculateDateRange(DashboardPeriod.CUSTOM, '2023-01-01', '2024-03-01'),
      ).toThrow(BadRequestException);
    });

    it('should allow exactly 365 days', () => {
      expect(() =>
        calculateDateRange(DashboardPeriod.CUSTOM, '2024-01-01', '2024-12-31'),
      ).not.toThrow();
    });

    it('should allow startDate equal to endDate', () => {
      const { startDate, endDate } = calculateDateRange(
        DashboardPeriod.CUSTOM,
        '2024-06-15',
        '2024-06-15',
      );
      expect(startDate.getTime()).toBe(endDate.getTime());
    });
  });

  describe('default period', () => {
    it('should default to CURRENT_MONTH when no period provided', () => {
      const { startDate } = calculateDateRange(undefined);

      const now = new Date();
      expect(startDate.getMonth()).toBe(now.getMonth());
      expect(startDate.getDate()).toBe(1);
    });
  });
});

describe('QueryDashboardDto', () => {
  it('should have validateDateRange method that delegates to calculateDateRange', () => {
    const dto = new QueryDashboardDto();
    dto.period = DashboardPeriod.CUSTOM;
    dto.startDate = '2024-01-01';
    dto.endDate = '2024-01-31';

    const { startDate, endDate } = dto.validateDateRange();
    expect(startDate).toBeInstanceOf(Date);
    expect(endDate).toBeInstanceOf(Date);
  });
});
