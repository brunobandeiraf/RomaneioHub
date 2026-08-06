'use client';

import { useCallback } from 'react';
import type { Product } from '@/types/order';

export interface OrderItemFormData {
  productId: string;
  quantidade: string;
  precoUnit: string;
}

interface OrderItemRowProps {
  index: number;
  item: OrderItemFormData;
  products: Product[];
  onChange: (index: number, field: keyof OrderItemFormData, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function OrderItemRow({
  index,
  item,
  products,
  onChange,
  onRemove,
  canRemove,
}: OrderItemRowProps) {
  const quantidade = parseFloat(item.quantidade) || 0;
  const precoUnit = parseFloat(item.precoUnit) || 0;
  const subtotal = quantidade * precoUnit;

  const handleChange = useCallback(
    (field: keyof OrderItemFormData, value: string) => {
      onChange(index, field, value);
    },
    [index, onChange]
  );

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-2">
        <select
          value={item.productId}
          onChange={(e) => handleChange('productId', e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label={`Produto do item ${index + 1}`}
          required
        >
          <option value="">Selecione um produto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.nome} ({product.unidade})
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          value={item.quantidade}
          onChange={(e) => handleChange('quantidade', e.target.value)}
          min="0.001"
          step="0.001"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label={`Quantidade do item ${index + 1}`}
          placeholder="0,000"
          required
        />
      </td>
      <td className="py-2 px-2">
        <input
          type="number"
          value={item.precoUnit}
          onChange={(e) => handleChange('precoUnit', e.target.value)}
          min="0.01"
          step="0.01"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label={`Preço unitário do item ${index + 1}`}
          placeholder="0,00"
          required
        />
      </td>
      <td className="py-2 px-2 text-right text-sm font-medium text-gray-700 whitespace-nowrap">
        R$ {subtotal.toFixed(2)}
      </td>
      <td className="py-2 pl-2">
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed p-1"
          aria-label={`Remover item ${index + 1}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </td>
    </tr>
  );
}
