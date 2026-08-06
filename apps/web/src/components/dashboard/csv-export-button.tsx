'use client';

import { Button } from '@/components/ui/button';
import { useExportCsv, PurchasesParams } from '@/hooks/use-dashboard';

interface CsvExportButtonProps {
  params: Omit<PurchasesParams, 'page' | 'pageSize'>;
}

export function CsvExportButton({ params }: CsvExportButtonProps) {
  const exportCsv = useExportCsv();

  const handleExport = () => {
    exportCsv.mutate({
      period: params.period,
      startDate: params.startDate,
      endDate: params.endDate,
      supplier: params.supplier,
      product: params.product,
      status: params.status,
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      loading={exportCsv.isPending}
      aria-label="Exportar dados em CSV"
    >
      Exportar CSV
    </Button>
  );
}
