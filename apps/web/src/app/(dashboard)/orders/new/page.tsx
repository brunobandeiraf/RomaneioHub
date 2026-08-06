'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCreateOrder, useSuppliers, useProducts } from '@/hooks/use-orders';
import { OrderItemRow, OrderItemFormData } from '../components/order-item-row';

const MIN_ITEMS = 1;
const MAX_ITEMS = 50;

const emptyItem = (): OrderItemFormData => ({
  productId: '',
  quantidade: '',
  precoUnit: '',
});

export default function NewOrderPage() {
  const router = useRouter();
  const { data: suppliers, isLoading: loadingSuppliers } = useSuppliers();
  const { data: products, isLoading: loadingProducts } = useProducts();
  const createOrder = useCreateOrder();

  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<OrderItemFormData[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);

  const handleItemChange = useCallback(
    (index: number, field: keyof OrderItemFormData, value: string) => {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  const handleAddItem = useCallback(() => {
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, emptyItem()]);
  }, [items.length]);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => {
      if (prev.length <= MIN_ITEMS) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const orderTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantidade = parseFloat(item.quantidade) || 0;
      const precoUnit = parseFloat(item.precoUnit) || 0;
      return sum + quantidade * precoUnit;
    }, 0);
  }, [items]);

  const validate = useCallback((): string | null => {
    if (!supplierId) return 'Selecione um fornecedor.';
    if (!date) return 'Informe a data do pedido.';
    if (items.length < MIN_ITEMS) return `O pedido deve ter no mínimo ${MIN_ITEMS} item.`;
    if (items.length > MAX_ITEMS) return `O pedido pode ter no máximo ${MAX_ITEMS} itens.`;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) return `Selecione o produto do item ${i + 1}.`;
      const qtd = parseFloat(item.quantidade);
      if (!qtd || qtd <= 0) return `Informe a quantidade do item ${i + 1}.`;
      const preco = parseFloat(item.precoUnit);
      if (!preco || preco <= 0) return `Informe o preço unitário do item ${i + 1}.`;
    }

    return null;
  }, [supplierId, date, items]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const validationError = validate();
      if (validationError) {
        setError(validationError);
        return;
      }

      try {
        const order = await createOrder.mutateAsync({
          supplierId,
          date,
          items: items.map((item) => ({
            productId: item.productId,
            quantidade: parseFloat(item.quantidade),
            precoUnit: parseFloat(item.precoUnit),
          })),
        });
        router.push(`/orders/${order.id}`);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(
          axiosErr?.response?.data?.message || 'Erro ao criar pedido. Tente novamente.'
        );
      }
    },
    [supplierId, date, items, validate, createOrder, router]
  );

  const isLoadingData = loadingSuppliers || loadingProducts;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Novo Pedido</h1>
        <Link href="/orders">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      {isLoadingData ? (
        <div className="p-8 text-center text-gray-500">Carregando dados...</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Supplier */}
              <div>
                <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 mb-1">
                  Fornecedor *
                </label>
                <select
                  id="supplier"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione um fornecedor</option>
                  {suppliers?.filter((s) => s.active).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.razaoSocial}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label htmlFor="order-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Data *
                </label>
                <input
                  id="order-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Items section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Itens ({items.length}/{MAX_ITEMS})
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                disabled={items.length >= MAX_ITEMS}
              >
                + Adicionar Item
              </Button>
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
                    <th className="pb-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <OrderItemRow
                      key={index}
                      index={index}
                      item={item}
                      products={products?.filter((p) => p.active) ?? []}
                      onChange={handleItemChange}
                      onRemove={handleRemoveItem}
                      canRemove={items.length > MIN_ITEMS}
                    />
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

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link href="/orders">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" loading={createOrder.isPending}>
              Criar Pedido
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
