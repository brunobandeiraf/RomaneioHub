'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  useOrder,
  useUpdateOrderStatus,
  useGetDownloadUrl,
  useAddOrderItem,
  useUpdateOrderItem,
  useRemoveOrderItem,
  useProducts,
} from '@/hooks/use-orders';
import {
  OrderStatus,
  STATUS_LABELS,
  STATUS_COLORS,
  VALID_TRANSITIONS,
} from '@/types/order';
import { InvoiceUpload } from '../components/invoice-upload';

const MAX_ITEMS = 50;

interface EditingItem {
  productId: string;
  quantidade: string;
  precoUnit: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { user } = useAuth();
  const isViewer = user?.role === 'ACCOUNTING_VIEWER';

  const { data: order, isLoading, isError, refetch } = useOrder(orderId);
  const { data: products } = useProducts();
  const updateStatus = useUpdateOrderStatus(orderId);
  const downloadUrl = useGetDownloadUrl();
  const addItem = useAddOrderItem(orderId);
  const updateItem = useUpdateOrderItem(orderId);
  const removeItem = useRemoveOrderItem(orderId);

  const [statusError, setStatusError] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState<EditingItem>({
    productId: '',
    quantidade: '',
    precoUnit: '',
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<EditingItem>({
    productId: '',
    quantidade: '',
    precoUnit: '',
  });
  const [itemError, setItemError] = useState<string | null>(null);

  const isDraft = order?.status === 'DRAFT';
  const canEditItems = isDraft && !isViewer;

  const activeProducts = useMemo(
    () => products?.filter((p) => p.active) ?? [],
    [products]
  );

  const handleStatusTransition = useCallback(
    async (newStatus: OrderStatus) => {
      setStatusError(null);
      try {
        await updateStatus.mutateAsync({ status: newStatus });
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setStatusError(
          axiosErr?.response?.data?.message ||
            `Erro ao alterar status para ${STATUS_LABELS[newStatus]}.`
        );
      }
    },
    [updateStatus]
  );

  const handleDownloadInvoice = useCallback(
    async (invoiceId: string) => {
      try {
        const { downloadUrl: url } = await downloadUrl.mutateAsync({
          orderId,
          invoiceId,
        });
        window.open(url, '_blank');
      } catch {
        // Silently handle
      }
    },
    [orderId, downloadUrl]
  );

  const handleAddItem = useCallback(async () => {
    setItemError(null);
    if (!newItem.productId) {
      setItemError('Selecione um produto.');
      return;
    }
    const quantidade = parseFloat(newItem.quantidade);
    if (!quantidade || quantidade <= 0) {
      setItemError('Informe a quantidade.');
      return;
    }
    const precoUnit = parseFloat(newItem.precoUnit);
    if (!precoUnit || precoUnit <= 0) {
      setItemError('Informe o preço unitário.');
      return;
    }

    try {
      await addItem.mutateAsync({
        productId: newItem.productId,
        quantidade,
        precoUnit,
      });
      setNewItem({ productId: '', quantidade: '', precoUnit: '' });
      setShowAddItem(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setItemError(axiosErr?.response?.data?.message || 'Erro ao adicionar item.');
    }
  }, [newItem, addItem]);

  const handleStartEdit = useCallback(
    (itemId: string) => {
      const item = order?.items?.find((i) => i.id === itemId);
      if (!item) return;
      setEditingItemId(itemId);
      setEditItem({
        productId: item.productId,
        quantidade: String(item.quantidade),
        precoUnit: String(item.precoUnit),
      });
      setItemError(null);
    },
    [order]
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingItemId) return;
    setItemError(null);

    if (!editItem.productId) {
      setItemError('Selecione um produto.');
      return;
    }
    const quantidade = parseFloat(editItem.quantidade);
    if (!quantidade || quantidade <= 0) {
      setItemError('Informe a quantidade.');
      return;
    }
    const precoUnit = parseFloat(editItem.precoUnit);
    if (!precoUnit || precoUnit <= 0) {
      setItemError('Informe o preço unitário.');
      return;
    }

    try {
      await updateItem.mutateAsync({
        itemId: editingItemId,
        productId: editItem.productId,
        quantidade,
        precoUnit,
      });
      setEditingItemId(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setItemError(axiosErr?.response?.data?.message || 'Erro ao atualizar item.');
    }
  }, [editingItemId, editItem, updateItem]);

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      if ((order?.items?.length ?? 0) <= 1) {
        setItemError('O pedido deve ter no mínimo 1 item.');
        return;
      }
      setItemError(null);
      try {
        await removeItem.mutateAsync(itemId);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setItemError(axiosErr?.response?.data?.message || 'Erro ao remover item.');
      }
    },
    [order, removeItem]
  );

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="p-8 text-center text-gray-500">Carregando pedido...</div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="p-8 text-center text-red-600">
          Erro ao carregar pedido. <Link href="/orders" className="underline">Voltar à lista</Link>
        </div>
      </div>
    );
  }

  const validTransitions = VALID_TRANSITIONS[order.status as OrderStatus] || [];
  const canManageStatus = !isViewer && validTransitions.length > 0;
  const canUploadInvoice = !isViewer;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/orders" className="text-sm text-blue-600 hover:text-blue-800 mb-1 inline-block">
            ← Voltar aos pedidos
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Detalhes do Pedido</h1>
        </div>
      </div>

      {/* Order header info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Fornecedor</p>
            <p className="text-sm font-medium text-gray-900">
              {order.supplierName || order.supplierId}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Data</p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(order.date).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status as OrderStatus]}`}
            >
              {STATUS_LABELS[order.status as OrderStatus]}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-lg font-bold text-gray-900">
              R$ {Number(order.total).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Status transition buttons */}
        {canManageStatus && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Alterar status:</p>
            <div className="flex gap-2 flex-wrap">
              {validTransitions.map((newStatus) => (
                <Button
                  key={newStatus}
                  size="sm"
                  variant={newStatus === 'CANCELLED' ? 'secondary' : 'primary'}
                  onClick={() => handleStatusTransition(newStatus)}
                  loading={updateStatus.isPending}
                >
                  {newStatus === 'CONFIRMED' && 'Confirmar'}
                  {newStatus === 'DELIVERED' && 'Marcar como Entregue'}
                  {newStatus === 'CANCELLED' && 'Cancelar Pedido'}
                </Button>
              ))}
            </div>
            {statusError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {statusError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Itens ({order.items?.length || 0})
          </h2>
          {canEditItems && (order.items?.length ?? 0) < MAX_ITEMS && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAddItem(true);
                setItemError(null);
              }}
            >
              + Adicionar Item
            </Button>
          )}
        </div>

        {itemError && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700" role="alert">
            {itemError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Produto
                </th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Quantidade
                </th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Preço Unit.
                </th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Subtotal
                </th>
                {canEditItems && (
                  <th className="pb-2 text-center text-xs font-medium text-gray-500 uppercase w-24">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items?.map((item) =>
                editingItemId === item.id ? (
                  <tr key={item.id} className="bg-blue-50">
                    <td className="py-2 pr-2">
                      <select
                        value={editItem.productId}
                        onChange={(e) =>
                          setEditItem((prev) => ({ ...prev, productId: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Selecionar produto"
                      >
                        <option value="">Selecione</option>
                        {activeProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome} ({p.unidade})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={editItem.quantidade}
                        onChange={(e) =>
                          setEditItem((prev) => ({ ...prev, quantidade: e.target.value }))
                        }
                        min="0.001"
                        step="0.001"
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Quantidade"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={editItem.precoUnit}
                        onChange={(e) =>
                          setEditItem((prev) => ({ ...prev, precoUnit: e.target.value }))
                        }
                        min="0.01"
                        step="0.01"
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Preço unitário"
                      />
                    </td>
                    <td className="py-2 px-2 text-sm text-right font-medium text-gray-700">
                      R$ {((parseFloat(editItem.quantidade) || 0) * (parseFloat(editItem.precoUnit) || 0)).toFixed(2)}
                    </td>
                    <td className="py-2 pl-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={handleSaveEdit}
                          className="text-green-600 hover:text-green-800 text-xs font-medium px-2 py-1 rounded hover:bg-green-50"
                          disabled={updateItem.isPending}
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="text-gray-500 hover:text-gray-700 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id}>
                    <td className="py-3 text-sm text-gray-900">
                      {item.productName || item.productId}
                    </td>
                    <td className="py-3 text-sm text-gray-700 text-right">
                      {Number(item.quantidade).toFixed(3)}
                    </td>
                    <td className="py-3 text-sm text-gray-700 text-right">
                      R$ {Number(item.precoUnit).toFixed(2)}
                    </td>
                    <td className="py-3 text-sm font-medium text-gray-900 text-right">
                      R$ {Number(item.subtotal).toFixed(2)}
                    </td>
                    {canEditItems && (
                      <td className="py-3 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleStartEdit(item.id)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded hover:bg-blue-50"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 rounded hover:bg-red-50"
                            disabled={removeItem.isPending}
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              )}

              {/* Add new item row */}
              {showAddItem && canEditItems && (
                <tr className="bg-green-50">
                  <td className="py-2 pr-2">
                    <select
                      value={newItem.productId}
                      onChange={(e) =>
                        setNewItem((prev) => ({ ...prev, productId: e.target.value }))
                      }
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Selecionar produto para novo item"
                    >
                      <option value="">Selecione um produto</option>
                      {activeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({p.unidade})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      value={newItem.quantidade}
                      onChange={(e) =>
                        setNewItem((prev) => ({ ...prev, quantidade: e.target.value }))
                      }
                      min="0.001"
                      step="0.001"
                      placeholder="0,000"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Quantidade do novo item"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      value={newItem.precoUnit}
                      onChange={(e) =>
                        setNewItem((prev) => ({ ...prev, precoUnit: e.target.value }))
                      }
                      min="0.01"
                      step="0.01"
                      placeholder="0,00"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Preço unitário do novo item"
                    />
                  </td>
                  <td className="py-2 px-2 text-sm text-right font-medium text-gray-700">
                    R$ {((parseFloat(newItem.quantidade) || 0) * (parseFloat(newItem.precoUnit) || 0)).toFixed(2)}
                  </td>
                  <td className="py-2 pl-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={handleAddItem}
                        className="text-green-600 hover:text-green-800 text-xs font-medium px-2 py-1 rounded hover:bg-green-50"
                        disabled={addItem.isPending}
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => {
                          setShowAddItem(false);
                          setNewItem({ productId: '', quantidade: '', precoUnit: '' });
                        }}
                        className="text-gray-500 hover:text-gray-700 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={canEditItems ? 4 : 3} className="pt-3 text-sm font-medium text-gray-700 text-right">
                  Total:
                </td>
                <td className={`pt-3 text-lg font-bold text-gray-900 ${canEditItems ? 'text-center' : 'text-right'}`}>
                  R$ {Number(order.total).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Invoices section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Notas Fiscais ({order.invoices?.length || 0})
        </h2>

        {/* Existing invoices list */}
        {order.invoices && order.invoices.length > 0 ? (
          <div className="space-y-2 mb-4">
            {order.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {invoice.contentType === 'application/pdf' ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8 text-red-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8 text-blue-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {invoice.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(invoice.sizeBytes / 1024 / 1024).toFixed(2)} MB •{' '}
                      {new Date(invoice.uploadedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadInvoice(invoice.id)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  disabled={downloadUrl.isPending}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">
            Nenhuma nota fiscal anexada a este pedido.
          </p>
        )}

        {/* Upload component */}
        {canUploadInvoice && (
          <InvoiceUpload orderId={orderId} onSuccess={() => refetch()} />
        )}
      </div>
    </div>
  );
}
