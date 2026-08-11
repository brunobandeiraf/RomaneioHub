'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ProductForm, ProductFormData } from '@/components/products/product-form';
import { ProductSupplierList } from '@/components/products/product-supplier-list';
import { useProduct, useUpdateProduct } from '../hooks/use-products';

export default function ProductDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const productId = params.id as string;
  const isViewer = user?.role === 'ACCOUNTING_VIEWER';

  const { data: product, isLoading, error } = useProduct(productId);
  const updateProduct = useUpdateProduct(productId);

  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (data: ProductFormData) => {
    setApiError('');
    setSuccessMessage('');

    try {
      await updateProduct.mutateAsync(data);
      setSuccessMessage('Produto atualizado com sucesso!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setApiError(
        axiosError.response?.data?.message || 'Erro ao atualizar produto. Tente novamente.'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">
            Erro ao carregar produto. O produto pode não existir ou você não tem permissão.
          </p>
          <Link href="/products" className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block">
            ← Voltar para produtos
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/products"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          ← Voltar para produtos
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{product.nome}</h1>
          <span
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              product.active
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {product.active ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Product Edit Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados do Produto</h2>
        <ProductForm
          initialData={{
            nome: product.nome,
            categoria: product.categoria,
            unidade: product.unidade,
            precoReferencia: product.precoReferencia,
          }}
          onSubmit={handleSubmit}
          isSubmitting={updateProduct.isPending}
          submitLabel="Salvar Alterações"
          disabled={isViewer}
          apiError={apiError}
        />
      </div>

      {/* Supplier Associations */}
      <ProductSupplierList
        productId={productId}
        suppliers={product.suppliers || []}
        isViewer={isViewer}
      />
    </div>
  );
}
