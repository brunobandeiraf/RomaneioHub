'use client';

interface SummaryCardsProps {
  totalSpent: number;
  orderCount: number;
  supplierCount: number;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function SummaryCards({
  totalSpent,
  orderCount,
  supplierCount,
  isLoading,
}: SummaryCardsProps) {
  const cards = [
    {
      title: 'Total Gasto',
      value: formatCurrency(totalSpent),
      icon: '💰',
    },
    {
      title: 'Nº Pedidos',
      value: orderCount.toLocaleString('pt-BR'),
      icon: '📦',
    },
    {
      title: 'Nº Fornecedores',
      value: supplierCount.toLocaleString('pt-BR'),
      icon: '🏢',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              {card.icon}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-500">{card.title}</p>
              {isLoading ? (
                <div className="mt-1 h-7 w-24 animate-pulse rounded bg-gray-200" />
              ) : (
                <p className="mt-1 text-xl font-semibold text-gray-900">
                  {card.value}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
