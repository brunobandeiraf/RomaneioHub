'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import {
  useAddProductSupplier,
  useUpdateProductSupplier,
  useRemoveProductSupplier,
  ProductSupplier,
} from '@/app/(dashboard)/products/hooks/use-products';

interface SupplierOption {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
}

interface ProductSupplierListProps {
  productId: string;
  suppliers: ProductSupplier[];
  isViewer: boolean;
}

export function ProductSupplierList({
  productId,
  suppliers,
  isViewer,
}: ProductSupplierListProps) {
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Fornecedores Associados
        </h2>
        {!isViewer && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddSupplier(true)}
          >
            Adicionar Fornecedor
          </Button>
        )}
      </div>

      {/* Add supplier form */}
      {showAddSupplier && (
        <AddSupplierForm
          productId={productId}
          existingSupplierIds={suppliers.map((s) => s.supplierId)}
          onClose={() => setShowAddSupplier(false)}
        />
      )}

      {/* Suppliers list */}
      {suppliers.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fornecedor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CNPJ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Preço
                </th>
                {!isViewer && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {suppliers.map((ps) => (
                <SupplierRow
                  key={ps.id}
                  productSupplier={ps}
                  productId={productId}
                  isViewer={isViewer}
                  editingSupplier={editingSupplier}
                  setEditingSupplier={setEditingSupplier}
                  editPrice={editPrice}
                  setEditPrice={setEditPrice}
                  formatCurrency={formatCurrency}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500 py-4">
          Nenhum fornecedor associado a este produto.
        </p>
      )}
    </div>
  );
}

// Add supplier form component
function AddSupplierForm({
  productId,
  existingSupplierIds,
  onClose,
}: {
  productId: string;
  existingSupplierIds: string[];
  onClose: () => void;
}) {
  const addSupplier = useAddProductSupplier(productId);
  const [availableSuppliers, setAvailableSuppliers] = useState<SupplierOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierPrice, setSupplierPrice] = useState('');
  const [supplierError, setSupplierError] = useState('');

  // Fetch available suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await apiClient.get('/suppliers?active=true&pageSize=100');
        const suppliers = response.data.data || response.data;
        setAvailableSuppliers(Array.isArray(suppliers) ? suppliers : []);
      } catch {
        // Silently fail, user can retry
      }
    };
    fetchSuppliers();
  }, []);

  const filteredSuppliers = availableSuppliers.filter(
    (s) => !existingSupplierIds.includes(s.id)
  );

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[\d.,]*$/.test(value)) {
      setSupplierPrice(value);
    }
  };

  const handlePriceBlur = () => {
    if (supplierPrice) {
      const value = parseFloat(supplierPrice.replace(',', '.'));
      if (!isNaN(value)) {
        setSupplierPrice(value.toFixed(2).replace('.', ','));
      }
    }
  };

  const handleAdd = async () => {
    setSupplierError('');

    if (!selectedSupplierId) {
      setSupplierError('Selecione um fornecedor');
      return;
    }

    if (!supplierPrice.trim()) {
      setSupplierError('Preço é obrigatório');
      return;
    }

    const price = parseFloat(supplierPrice.replace(',', '.'));
    if (isNaN(price) || price < 0.01 || price > 9999999999.99) {
      setSupplierError('Preço deve estar entre R$ 0,01 e R$ 9.999.999.999,99');
      return;
    }

    try {
      await addSupplier.mutateAsync({
        supplierId: selectedSupplierId,
        price,
      });
      onClose();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setSupplierError(
        axiosError.response?.data?.message || 'Erro ao associar fornecedor.'
      );
    }
  };

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">
        Adicionar Fornecedor
      </h3>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Selecionar fornecedor"
          >
            <option value="">Selecione um fornecedor</option>
            {filteredSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.razaoSocial}
                {s.nomeFantasia ? ` (${s.nomeFantasia})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:w-40">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500">
              R$
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={supplierPrice}
              onChange={handlePriceChange}
              onBlur={handlePriceBlur}
              className="w-full rounded-md border border-gray-300 px-3 py-2 pl-9 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Preço do fornecedor"
            />
          </div>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleAdd}
          loading={addSupplier.isPending}
        >
          Adicionar
        </Button>
        <Button variant="outline" size="md" onClick={onClose}>
          Cancelar
        </Button>
      </div>
      {supplierError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {supplierError}
        </p>
      )}
    </div>
  );
}

// Supplier row component
function SupplierRow({
  productSupplier,
  productId,
  isViewer,
  editingSupplier,
  setEditingSupplier,
  editPrice,
  setEditPrice,
  formatCurrency,
}: {
  productSupplier: ProductSupplier;
  productId: string;
  isViewer: boolean;
  editingSupplier: string | null;
  setEditingSupplier: (id: string | null) => void;
  editPrice: string;
  setEditPrice: (price: string) => void;
  formatCurrency: (value: string | number) => string;
}) {
  const updateSupplier = useUpdateProductSupplier(productId);
  const removeSupplier = useRemoveProductSupplier(productId);

  const isEditing = editingSupplier === productSupplier.supplierId;

  const handleStartEdit = () => {
    const price = parseFloat(productSupplier.price);
    setEditPrice(isNaN(price) ? '' : price.toFixed(2).replace('.', ','));
    setEditingSupplier(productSupplier.supplierId);
  };

  const handleEditPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[\d.,]*$/.test(value)) {
      setEditPrice(value);
    }
  };

  const handleSavePrice = async () => {
    const price = parseFloat(editPrice.replace(',', '.'));
    if (isNaN(price) || price < 0.01 || price > 9999999999.99) return;

    try {
      await updateSupplier.mutateAsync({
        supplierId: productSupplier.supplierId,
        data: { price },
      });
      setEditingSupplier(null);
    } catch {
      // Keep editing on failure
    }
  };

  const handleCancelEdit = () => {
    setEditingSupplier(null);
    setEditPrice('');
  };

  const handleRemove = async () => {
    try {
      await removeSupplier.mutateAsync(productSupplier.supplierId);
    } catch {
      // Silently fail, user can retry
    }
  };

  return (
    <tr>
      <td className="px-4 py-3 text-sm text-gray-900">
        {productSupplier.supplier.razaoSocial}
        {productSupplier.supplier.nomeFantasia && (
          <span className="text-gray-500 ml-1">
            ({productSupplier.supplier.nomeFantasia})
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {productSupplier.supplier.cnpj}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <div className="relative w-32">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-xs text-gray-500">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={editPrice}
                onChange={handleEditPriceChange}
                className="w-full rounded border border-gray-300 px-2 py-1 pl-7 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Editar preço"
                autoFocus
              />
            </div>
            <button
              onClick={handleSavePrice}
              className="text-green-600 hover:text-green-800 text-sm font-medium"
              disabled={updateSupplier.isPending}
              aria-label="Salvar preço"
            >
              ✓
            </button>
            <button
              onClick={handleCancelEdit}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium"
              aria-label="Cancelar edição"
            >
              ✕
            </button>
          </div>
        ) : (
          formatCurrency(productSupplier.price)
        )}
      </td>
      {!isViewer && (
        <td className="px-4 py-3 text-right text-sm">
          {!isEditing && (
            <div className="flex justify-end gap-3">
              <button
                onClick={handleStartEdit}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Editar
              </button>
              <button
                onClick={handleRemove}
                className="text-red-600 hover:text-red-800 font-medium"
                disabled={removeSupplier.isPending}
              >
                Remover
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
