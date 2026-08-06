'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { useProducts, useDeleteProduct } from './hooks/use-products';

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isViewer = user?.role === 'ACCOUNTING_VIEWER';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pageSize = 20;

  const { data, isLoading, error } = useProducts({
    page,
    pageSize,
    search: search || undefined,
    categoria: categoriaFilter || undefined,
    active: activeFilter || undefined,
  });

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setSearchInput('');
    setCategoriaFilter('');
    setActiveFilter('');
    setPage(1);
  }, []);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
        {!isViewer && (
          <Link href="/products/new">
            <Button variant="primary">Novo Produto</Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nome..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <div className="sm:w-48">
            <input
              type="text"
              placeholder="Filtrar por categoria"
              value={categoriaFilter}
              onChange={(e) => {
                setCategoriaFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="sm:w-40">
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Filtrar por status"
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
          <Button variant="outline" size="md" onClick={handleSearch}>
            Buscar
          </Button>
          <Button variant="outline" size="md" onClick={handleClearFilters}>
            Limpar
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-700">
            Erro ao carregar produtos. Tente novamente.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <svg
            className="animate-spin h-8 w-8 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}

      {/* Table */}
      {!isLoading && data && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unidade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Referência
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fornecedores
                    </th>
                    {!isViewer && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isViewer ? 6 : 7}
                        className="px-6 py-12 text-center text-sm text-gray-500"
                      >
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  ) : (
                    data.data.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        isViewer={isViewer}
                        deleteConfirmId={deleteConfirmId}
                        deletingId={deletingId}
                        setDeleteConfirmId={setDeleteConfirmId}
                        setDeletingId={setDeletingId}
                        onNavigate={() => router.push(`/products/${product.id}`)}
                        formatCurrency={formatCurrency}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-700">
                Mostrando{' '}
                <span className="font-medium">
                  {(page - 1) * pageSize + 1}
                </span>{' '}
                a{' '}
                <span className="font-medium">
                  {Math.min(page * pageSize, data.meta.total)}
                </span>{' '}
                de <span className="font-medium">{data.meta.total}</span>{' '}
                resultados
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <DeleteConfirmModal
          productId={deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          onDeleted={() => {
            setDeleteConfirmId(null);
            setDeletingId(null);
          }}
          setDeletingId={setDeletingId}
          deletingId={deletingId}
        />
      )}
    </div>
  );
}

// Product row component
function ProductRow({
  product,
  isViewer,
  deleteConfirmId,
  deletingId,
  setDeleteConfirmId,
  setDeletingId,
  onNavigate,
  formatCurrency,
}: {
  product: {
    id: string;
    nome: string;
    categoria: string;
    unidade: string;
    precoReferencia: string;
    active: boolean;
    _count?: { suppliers: number; orderItems: number };
  };
  isViewer: boolean;
  deleteConfirmId: string | null;
  deletingId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  setDeletingId: (id: string | null) => void;
  onNavigate: () => void;
  formatCurrency: (value: string | number) => string;
}) {
  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer"
      onClick={onNavigate}
    >
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {product.nome}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {product.categoria}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {product.unidade}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatCurrency(product.precoReferencia)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            product.active
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {product.active ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {product._count?.suppliers ?? 0}
      </td>
      {!isViewer && (
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmId(product.id);
            }}
            className="text-red-600 hover:text-red-800 font-medium"
            aria-label={`Excluir produto ${product.nome}`}
          >
            Excluir
          </button>
        </td>
      )}
    </tr>
  );
}

// Delete confirmation modal
function DeleteConfirmModal({
  productId,
  onClose,
  onDeleted,
  setDeletingId,
  deletingId,
}: {
  productId: string;
  onClose: () => void;
  onDeleted: () => void;
  setDeletingId: (id: string | null) => void;
  deletingId: string | null;
}) {
  const deleteProduct = useDeleteProduct(productId);

  const handleDelete = async () => {
    setDeletingId(productId);
    try {
      await deleteProduct.mutateAsync();
      onDeleted();
    } catch {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Confirmar exclusão
        </h2>
        <p className="text-sm text-gray-600 mb-1">
          Tem certeza que deseja excluir este produto?
        </p>
        <p className="text-xs text-gray-500 mb-6">
          Se o produto possui pedidos vinculados, ele será inativado ao invés de
          excluído permanentemente.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            loading={deletingId === productId}
            onClick={handleDelete}
          >
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}
