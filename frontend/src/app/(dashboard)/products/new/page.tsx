'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProductForm, ProductFormData } from '@/components/products/product-form';
import { useCreateProduct } from '../hooks/use-products';

export default function NewProductPage() {
  const router = useRouter();
  const createProduct = useCreateProduct();
  const [apiError, setApiError] = useState('');

  const handleSubmit = async (data: ProductFormData) => {
    setApiError('');
    try {
      await createProduct.mutateAsync(data);
      router.push('/products');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setApiError(
        axiosError.response?.data?.message || 'Erro ao criar produto. Tente novamente.'
      );
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/products"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          ← Voltar para produtos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Novo Produto</h1>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <ProductForm
          onSubmit={handleSubmit}
          isSubmitting={createProduct.isPending}
          submitLabel="Criar Produto"
          apiError={apiError}
          onCancel={() => router.push('/products')}
        />
      </div>
    </div>
  );
}
