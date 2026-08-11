'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCreateOrder, useSuppliers, useProducts } from '@/hooks/use-orders';
import { OrderItemsTable, OrderItemFormData } from './order-items-table';

const MIN_ITEMS = 1;
const MAX_ITEMS = 50;

const emptyItem = (): OrderItemFormData => ({
  productId: '',
  quantidade: '',
  precoUnit: '',
});

interface OrderFormProps {
  onSuccess?: (orderId: string) => void;
}

export function OrderForm({ onSuccess }: OrderFormProps) {
  const router = useRouter();
  const { data: suppliers, isLoading: loadingSuppliers } = useSuppliers();
  const { data: products, isLoading: loadingProducts } = useProducts();
  const createOrder = useCreateOrder();

  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<OrderItemFormData[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);

  const activeProducts = useMemo(
    () => products?.filter((p) => p.active) ?? [],
    [products]
  );

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
        if (onSuccess) {
          onSuccess(order.id);
        } else {
          router.push(`/orders/${order.id}`);
        }
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(
          axiosErr?.response?.data?.message || 'Erro ao criar pedido. Tente novamente.'
        );
      }
    },
    [supplierId, date, items, validate, createOrder, router, onSuccess]
  );

  const isLoadingData = loadingSuppliers || loadingProducts;

  if (isLoadingData) {
    return <div className="p-8 text-center text-gray-500">Carregando dados...</div>;
  }

  return (
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
        <OrderItemsTable
          items={items}
          products={activeProducts}
          onChange={handleItemChange}
          onAdd={handleAddItem}
          onRemove={handleRemoveItem}
          maxItems={MAX_ITEMS}
          minItems={MIN_ITEMS}
        />
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
  );
}
