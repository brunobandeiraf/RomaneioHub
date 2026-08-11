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
  const [editMode, setEditMode] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
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
        const { apiClient } = await import('@/lib/api-client');
        const response = await apiClient.get(
          `/orders/${orderId}/invoices/${invoiceId}/view`,
          { responseType: 'blob' }
        );
        const blob = new Blob([response.data], { type: String(response.headers['content-type'] || 'application/pdf') });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Clean up after a delay
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch {
        // Silently handle
      }
    },
    [orderId]
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
      setConfirmRemoveId(itemId);
    },
    [order]
  );

  const confirmRemove = useCallback(async () => {
    if (!confirmRemoveId) return;
    setItemError(null);
    try {
      await removeItem.mutateAsync(confirmRemoveId);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setItemError(axiosErr?.response?.data?.message || 'Erro ao remover item.');
    }
    setConfirmRemoveId(null);
  }, [confirmRemoveId, removeItem]);

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
  const canManageStatus = !isViewer && validTransitions.length > 0 && editMode;
  const canUploadInvoice = !isViewer;
  const canEditItems = !isViewer && editMode;

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
        {!isViewer && (
          <Button
            variant={editMode ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? '✓ Concluir edição' : '✏️ Editar pedido'}
          </Button>
        )}
      </div>

      {/* Order header info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Fornecedor</p>
            <p className="text-sm font-medium text-gray-900">
              {order.supplier?.razaoSocial || order.supplier?.nomeFantasia || order.supplierId}
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

        {/* Status transition buttons — shown in edit mode */}
        {editMode && !isViewer && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">Alterar status:</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleStatusTransition('CANCELLED' as OrderStatus)}
                disabled={updateStatus.isPending || order.status === 'CANCELLED'}
                className="rounded-lg px-4 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancelado
              </button>
              <button
                onClick={() => handleStatusTransition('DRAFT' as OrderStatus)}
                disabled={updateStatus.isPending || order.status === 'DRAFT'}
                className="rounded-lg px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Processamento
              </button>
              <button
                onClick={() => handleStatusTransition('CONFIRMED' as OrderStatus)}
                disabled={updateStatus.isPending || order.status === 'CONFIRMED'}
                className="rounded-lg px-4 py-2 text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Entregue no Marketplace
              </button>
              <button
                onClick={() => handleStatusTransition('DELIVERED' as OrderStatus)}
                disabled={updateStatus.isPending || order.status === 'DELIVERED'}
                className="rounded-lg px-4 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Finalizado
              </button>
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
          <div className="mb-3 p-2 rounded border border-red-400/30 text-sm font-semibold text-red-500" role="alert">
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
                  <tr key={item.id} className="ring-1 ring-brand-gold/50 ring-inset">
                    <td className="py-2 pr-2">
                      <select
                        value={editItem.productId}
                        onChange={(e) =>
                          setEditItem((prev) => ({ ...prev, productId: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
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
                        min="1"
                        step="1"
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
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
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
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
                      {item.product?.nome || item.productId}
                    </td>
                    <td className="py-3 text-sm text-gray-700 text-right">
                      {Math.round(Number(item.quantidade))}
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
                <tr className="ring-1 ring-brand-gold/50 ring-inset">
                  <td className="py-2 pr-2">
                    <select
                      value={newItem.productId}
                      onChange={(e) =>
                        setNewItem((prev) => ({ ...prev, productId: e.target.value }))
                      }
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
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
                      min="1"
                      step="1"
                      placeholder="0,000"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
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
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
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

      {/* Documentos section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Documentos
        </h2>

        {/* Nota Fiscal de Compra */}
        <DocumentCategory
          title="📄 Nota Fiscal de Compra"
          description="Nota fiscal emitida pelo fornecedor"
          category="PURCHASE"
          documents={order.invoices?.filter((inv: any) => inv.category === 'PURCHASE' || !inv.category) || []}
          onDownload={handleDownloadInvoice}
          isDownloading={downloadUrl.isPending}
          orderId={orderId}
          canUpload={canUploadInvoice}
          onUploadSuccess={() => refetch()}
        />

        {/* Notas de Coleta */}
        <DocumentCategory
          title="🚚 Notas de Coleta"
          description="Documentos de coleta da mercadoria"
          category="COLLECTION"
          documents={order.invoices?.filter((inv: any) => inv.category === 'COLLECTION') || []}
          onDownload={handleDownloadInvoice}
          isDownloading={downloadUrl.isPending}
          orderId={orderId}
          canUpload={canUploadInvoice}
          onUploadSuccess={() => refetch()}
        />

        {/* Romaneio / Comprovante de Entrega */}
        <DocumentCategory
          title="✍️ Romaneio / Comprovante de Entrega"
          description="Romaneio ou foto com assinatura do motorista"
          category="WAYBILL"
          documents={order.invoices?.filter((inv: any) => inv.category === 'WAYBILL') || []}
          onDownload={handleDownloadInvoice}
          isDownloading={downloadUrl.isPending}
          orderId={orderId}
          canUpload={canUploadInvoice}
          onUploadSuccess={() => refetch()}
        />
      </div>

      {/* Confirmation modal for item removal */}
      {confirmRemoveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl mx-4" role="dialog" aria-modal="true" aria-labelledby="confirm-remove-title">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 id="confirm-remove-title" className="text-lg font-semibold text-gray-900">
                Remover item
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Tem certeza que deseja remover este item do pedido? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmRemoveId(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRemove}
                disabled={removeItem.isPending}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {removeItem.isPending ? 'Removendo...' : 'Sim, remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Document category component with inline upload */
function DocumentCategory({
  title,
  description,
  category,
  documents,
  onDownload,
  isDownloading,
  orderId,
  canUpload,
  onUploadSuccess,
}: {
  title: string;
  description: string;
  category: string;
  documents: any[];
  onDownload: (id: string) => void;
  isDownloading: boolean;
  orderId: string;
  canUpload: boolean;
  onUploadSuccess: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onDelete = async (invoiceId: string) => {
    setDeleteConfirmId(invoiceId);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const { apiClient } = await import('@/lib/api-client');
      await apiClient.delete(`/orders/${orderId}/invoices/${deleteConfirmId}`);
      onUploadSuccess(); // refresh
    } catch (err: any) {
      setUploadError(err?.response?.data?.message || 'Erro ao excluir arquivo.');
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setUploadError('Tipo de arquivo não permitido. Use PDF, PNG ou JPG.');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { apiClient } = await import('@/lib/api-client');
      await apiClient.post(
        `/orders/${orderId}/invoices/upload?category=${category}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      onUploadSuccess();
    } catch (err: any) {
      setUploadError(
        err?.response?.data?.message || 'Erro ao fazer upload. Tente novamente.'
      );
    } finally {
      setUploading(false);
      // Reset the input
      e.target.value = '';
    }
  };

  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {documents.length} {documents.length === 1 ? 'arquivo' : 'arquivos'}
          </span>
          {canUpload && (
            <label className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${uploading ? 'bg-gray-200 text-gray-400 cursor-wait' : 'bg-brand-gold text-brand-dark hover:bg-brand-gold-hover'}`}>
              {uploading ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-dark border-t-transparent" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )}
              {uploading ? 'Enviando...' : 'Adicionar'}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-red-500 mb-2">{uploadError}</p>
      )}

      {documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc: any) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div
                onClick={() => onDownload(doc.id)}
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="flex-shrink-0">
                  {doc.contentType === 'application/pdf' ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 underline decoration-dotted underline-offset-2">{doc.filename}</p>
                  <p className="text-xs text-gray-500">
                    {(doc.sizeBytes / 1024 / 1024).toFixed(2)} MB •{' '}
                    {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              {canUpload && (
                <button
                  onClick={() => onDelete(doc.id)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Excluir arquivo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-400">Nenhum documento nesta categoria</p>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl mx-4" role="dialog" aria-modal="true">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Excluir arquivo</h3>
              <p className="mt-2 text-sm text-gray-500">
                Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
