'use client';

import { DashboardPurchase, PurchasesResponse } from '@/hooks/use-dashboard';
import { Button } from '@/components/ui/button';

interface PurchasesListProps {
  data: PurchasesResponse | undefined;
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  supplierFilter: string;
  productFilter: string;
  statusFilter: string;
  onSupplierFilterChange: (value: string) => void;
  onProductFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-700';
    case 'CONFIRMED':
      return 'bg-blue-100 text-blue-700';
    case 'DELIVERED':
      return 'bg-green-100 text-green-700';
    case 'CANCELLED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'Rascunho';
    case 'CONFIRMED':
      return 'Confirmado';
    case 'DELIVERED':
      return 'Entregue';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return status;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(dateStr));
}

export function PurchasesList({
  data,
  isLoading,
  page,
  onPageChange,
  supplierFilter,
  productFilter,
  statusFilter,
  onSupplierFilterChange,
  onProductFilterChange,
  onStatusFilterChange,
}: PurchasesListProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Filters */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Filtrar por fornecedor..."
            value={supplierFilter}
            onChange={(e) => onSupplierFilterChange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filtrar por fornecedor"
          />
          <input
            type="text"
            placeholder="Filtrar por produto..."
            value={productFilter}
            onChange={(e) => onProductFilterChange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filtrar por produto"
          />
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filtrar por status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                Data
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                Fornecedor
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                Produtos
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                Qtd.
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                Valor
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">
                NF
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data && data.data.length > 0 ? (
              data.data.map((purchase: DashboardPurchase) => (
                <tr
                  key={purchase.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-900">
                    {formatDate(purchase.date)}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {purchase.supplier}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-gray-700">
                    {purchase.products}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {purchase.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(purchase.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                        purchase.status
                      )}`}
                    >
                      {getStatusLabel(purchase.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {purchase.invoiceId ? (
                      <a
                        href={`/api/invoices/${purchase.invoiceId}/download`}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Baixar
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  Nenhum registro encontrado para o período selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-500">
            Página {data.page} de {data.totalPages} ({data.total} registros)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
