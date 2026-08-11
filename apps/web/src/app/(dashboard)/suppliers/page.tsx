'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { formatCnpj } from '@romaneio-hub/shared';
import { useSuppliers, useDeleteSupplier, Supplier } from './hooks/use-suppliers';

export default function SuppliersPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const { data, isLoading, error } = useSuppliers({
    page,
    pageSize: 20,
    search: search || undefined,
    active: activeFilter,
  });

  const deleteMutation = useDeleteSupplier();

  const isViewer = user?.role === 'ACCOUNTING_VIEWER';

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
        {!isViewer && (
          <Link href="/suppliers/new">
            <Button>Novo Fornecedor</Button>
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            placeholder="Buscar por razão social ou CNPJ..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>
          Buscar
        </Button>
        <div className="flex gap-2">
          <Button
            variant={activeFilter === undefined ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setActiveFilter(undefined); setPage(1); }}
          >
            Todos
          </Button>
          <Button
            variant={activeFilter === true ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setActiveFilter(true); setPage(1); }}
          >
            Ativos
          </Button>
          <Button
            variant={activeFilter === false ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setActiveFilter(false); setPage(1); }}
          >
            Inativos
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Erro ao carregar fornecedores. Tente novamente.
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
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}

      {/* Table */}
      {data && !isLoading && (
        <>
          {data.data.length === 0 ? (
            <div className="rounded-md bg-gray-50 p-8 text-center">
              <p className="text-gray-500">Nenhum fornecedor encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Razão Social
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Nome Fantasia
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      CNPJ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {data.data.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        <Link
                          href={`/suppliers/${supplier.id}`}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {supplier.razaoSocial}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {supplier.nomeFantasia || '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatCnpj(supplier.cnpj)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            supplier.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {supplier.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          {!isViewer && (
                            <Link href={`/suppliers/${supplier.id}`}>
                              <Button variant="outline" size="sm">
                                Editar
                              </Button>
                            </Link>
                          )}
                          {!isViewer && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => setDeleteTarget(supplier)}
                            >
                              Excluir
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Mostrando página {data.page} de {data.totalPages} ({data.total} registros)
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
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-gray-900">
              Confirmar exclusão
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {deleteTarget.active
                ? 'Este fornecedor possui pedidos vinculados? Se sim, será inativado ao invés de excluído permanentemente.'
                : 'Este fornecedor já está inativo.'}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Deseja prosseguir com a exclusão de{' '}
              <strong>{deleteTarget.razaoSocial}</strong>?
            </p>

            {deleteMutation.error && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {deleteMutation.error.response?.data?.message ||
                  'Erro ao excluir fornecedor. Tente novamente.'}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteTarget(null);
                  deleteMutation.reset();
                }}
              >
                Cancelar
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                loading={deleteMutation.isPending}
                onClick={handleDelete}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
