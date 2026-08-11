'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MonthlyData } from '@/hooks/use-dashboard';

interface MonthlyChartProps {
  data: MonthlyData[];
  isLoading: boolean;
}

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function formatDateLabel(dateStr: string): string {
  // Input: YYYY-MM-DD → Output: DD/MM
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
}

export function MonthlyChart({ data, isLoading }: MonthlyChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-medium text-gray-500">
          Evolução de Pedidos
        </h3>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-gold" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-medium text-gray-500">
          Evolução de Pedidos
        </h3>
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">
          Sem dados para o período selecionado
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-gray-500">
        Evolução de Pedidos
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(150,150,150,0.1)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 11, fill: '#8b9bb4' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(150,150,150,0.15)' }}
            />
            <YAxis
              tickFormatter={formatCurrencyShort}
              tick={{ fontSize: 11, fill: '#8b9bb4' }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip
              formatter={(value: number) => [
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(value),
                'Valor',
              ]}
              labelFormatter={formatDateLabel}
              labelStyle={{ fontWeight: 600 }}
              contentStyle={{
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              itemStyle={{ color: '#d4a843' }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#d4a843"
              strokeWidth={2}
              dot={{ r: 4, fill: '#d4a843', stroke: '#141e35', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#e6bc5a', stroke: '#d4a843', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
