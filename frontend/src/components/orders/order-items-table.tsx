'use client';

import { useCallback, useMemo } from 'react';
import type { Product } from '@/types/order';

export interface OrderItemFormData {
  productId: string;
  quantidade: string;
  precoUnit: string;
}

interface OrderItemsTableProps {
  items: OrderItemFormData[];
  products: Product[];
  onChange: (index: number, field: keyof OrderItemFormData, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  maxItems?: number;
  minItems?: number;
  readOnly?: boolean;
}

export function OrderItemsTable({
  items,
  products,
  onChange,
  onAdd,
  onRemove,
  maxItems = 50,
  minItems = 1,
  readOnly = false,
}: OrderItemsTableProps) {
  const orderTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantidade = parseFloat(item.quantidade) || 0;
      const precoUnit = parseFloat(item.precoUnit) || 0;
      return sum + quantidade * precoUnit;
    }, 0);
  }, [items]);

  const getSubtotal = useCallback((item: OrderItemFormData) => {
    const quantidade = parseFloat(item.quantidade) || 0;
    const precoUnit = parseFloat(item.precoUnit) || 0;
    return quantidade * precoUnit;
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Itens ({items.length}/{maxItems})
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={onAdd}
            disabled={items.length >= maxItems}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Adicionar Item
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">
                Produto
              </th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase px-2">
                Quantidade
              </th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase px-2">
                Preço Unitário
              </th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase px-2">
                Subtotal
              </th>
              {!readOnly && <th className="pb-2 w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-2">
                  <select
                    value={item.productId}
                    onChange={(e) => onChange(index, 'productId', e.target.value)}
                    disabled={readOnly}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
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
                    onChange={(e) => onChange(index, 'quantidade', e.target.value)}
                    disabled={readOnly}
                    min="0.001"
                    step="0.001"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    aria-label={`Quantidade do item ${index + 1}`}
                    placeholder="0,000"
                    required
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    value={item.precoUnit}
                    onChange={(e) => onChange(index, 'precoUnit', e.target.value)}
                    disabled={readOnly}
                    min="0.01"
                    step="0.01"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    aria-label={`Preço unitário do item ${index + 1}`}
                    placeholder="0,00"
                    required
                  />
                </td>
                <td className="py-2 px-2 text-right text-sm font-medium text-gray-700 whitespace-nowrap">
                  R$ {getSubtotal(item).toFixed(2)}
                </td>
                {!readOnly && (
                  <td className="py-2 pl-2">
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      disabled={items.length <= minItems}
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
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
        <div className="text-right">
          <p className="text-sm text-gray-500">Total do Pedido</p>
          <p className="text-xl font-bold text-gray-900">
            R$ {orderTotal.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
