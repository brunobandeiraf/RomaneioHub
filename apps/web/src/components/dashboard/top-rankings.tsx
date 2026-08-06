'use client';

import { RankedItem } from '@/hooks/use-dashboard';

interface TopRankingsProps {
  topSuppliers: RankedItem[];
  topProducts: RankedItem[];
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function RankingList({
  title,
  items,
  isLoading,
}: {
  title: string;
  items: RankedItem[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-medium text-gray-500">{title}</h3>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-gray-500">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Sem dados para o período</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => {
            const maxTotal = items[0]?.total || 1;
            const widthPercent = (item.total / maxTotal) * 100;

            return (
              <li key={item.id} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {item.name}
                    </span>
                    <span className="ml-2 shrink-0 text-sm text-gray-600">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function TopRankings({
  topSuppliers,
  topProducts,
  isLoading,
}: TopRankingsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <RankingList
        title="Top 5 Fornecedores"
        items={topSuppliers}
        isLoading={isLoading}
      />
      <RankingList
        title="Top 5 Produtos"
        items={topProducts}
        isLoading={isLoading}
      />
    </div>
  );
}
