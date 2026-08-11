'use client';

import { useCallback, useState } from 'react';
import { PeriodFilter } from '@/hooks/use-dashboard';

interface PeriodFilterProps {
  period: PeriodFilter;
  startDate: string;
  endDate: string;
  onPeriodChange: (period: PeriodFilter) => void;
  onDateRangeChange: (startDate: string, endDate: string) => void;
}

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'current_month', label: 'Mês atual' },
  { value: 'previous_month', label: 'Mês anterior' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
  { value: 'custom', label: 'Personalizado' },
];

export function PeriodFilterComponent({
  period,
  startDate,
  endDate,
  onPeriodChange,
  onDateRangeChange,
}: PeriodFilterProps) {
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleStartChange = useCallback((value: string) => {
    setLocalStart(value);
    // If end date is before new start date, reset it
    if (localEnd && value > localEnd) {
      setLocalEnd(value);
    }
    setValidationError(null);
  }, [localEnd]);

  const handleEndChange = useCallback((value: string) => {
    setLocalEnd(value);
    setValidationError(null);
  }, []);

  const validateAndApply = useCallback(() => {
    if (!localStart || !localEnd) {
      setValidationError('Selecione as duas datas.');
      return;
    }
    if (localStart > localEnd) {
      setValidationError('Data final não pode ser anterior à inicial.');
      return;
    }
    const diffMs = new Date(localEnd).getTime() - new Date(localStart).getTime();
    if (diffMs / (1000 * 60 * 60 * 24) > 365) {
      setValidationError('Período máximo: 365 dias.');
      return;
    }
    setValidationError(null);
    onDateRangeChange(localStart, localEnd);
  }, [localStart, localEnd, onDateRangeChange]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Period buttons */}
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            setValidationError(null);
            onPeriodChange(option.value);
          }}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            period === option.value
              ? 'bg-brand-gold text-brand-dark'
              : 'bg-[#1a2a45] text-white hover:bg-[#243552]'
          }`}
          aria-pressed={period === option.value}
        >
          {option.label}
        </button>
      ))}

      {/* Custom date range — inline, same height as buttons */}
      {period === 'custom' && (
        <>
          <input
            type="date"
            value={localStart}
            onChange={(e) => handleStartChange(e.target.value)}
            className="h-[34px] rounded-lg border border-brand-border bg-brand-dark/50 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-gold/50 w-[130px]"
            aria-label="Data início"
          />
          <span className="text-xs text-brand-muted">até</span>
          <input
            type="date"
            value={localEnd}
            min={localStart || undefined}
            onChange={(e) => handleEndChange(e.target.value)}
            className="h-[34px] rounded-lg border border-brand-border bg-brand-dark/50 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-gold/50 w-[130px]"
            aria-label="Data fim"
          />
          <button
            type="button"
            onClick={validateAndApply}
            className="h-[34px] rounded-lg bg-brand-gold px-3 text-xs font-medium text-brand-dark hover:bg-brand-gold-hover transition-all"
          >
            Aplicar
          </button>
        </>
      )}

      {/* Validation error */}
      {validationError && (
        <p className="w-full text-xs text-red-400 mt-1" role="alert">
          {validationError}
        </p>
      )}
    </div>
  );
}
