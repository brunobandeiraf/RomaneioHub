'use client';

import { useCallback, useState } from 'react';
import { PeriodFilter } from '@/hooks/use-dashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

  const validateAndApplyRange = useCallback(() => {
    if (!localStart || !localEnd) {
      setValidationError('Selecione as datas de início e fim.');
      return;
    }

    const start = new Date(localStart);
    const end = new Date(localEnd);

    if (start > end) {
      setValidationError('A data de início deve ser anterior ou igual à data de fim.');
      return;
    }

    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 365) {
      setValidationError('O período máximo permitido é de 365 dias.');
      return;
    }

    setValidationError(null);
    onDateRangeChange(localStart, localEnd);
  }, [localStart, localEnd, onDateRangeChange]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setValidationError(null);
              onPeriodChange(option.value);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              period === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-pressed={period === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <Input
            type="date"
            label="Início"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
          />
          <Input
            type="date"
            label="Fim"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
          />
          <Button size="sm" onClick={validateAndApplyRange}>
            Aplicar
          </Button>
        </div>
      )}

      {validationError && (
        <p className="text-sm text-red-600" role="alert">
          {validationError}
        </p>
      )}
    </div>
  );
}
