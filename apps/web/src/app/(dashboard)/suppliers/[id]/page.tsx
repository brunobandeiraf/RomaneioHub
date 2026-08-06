'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SupplierForm, SupplierFormData } from '@/components/suppliers/supplier-form';
import { applyCnpjMask } from '@/components/ui/cnpj-input';
import { useSupplier, useUpdateSupplier } from '../hooks/use-suppliers';

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: supplier, isLoading, error } = useSupplier(id);
  const updateMutation = useUpdateSupplier(id);
  const [successMessage, setSuccessMessage] = useState('');

  function handleSubmit(data: SupplierFormData) {
    setSuccessMessage('');
    updateMutation.mutate(
      {
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        cnpj: data.cnpj,
        contato: data.contato,
        endereco: data.endereco,
      },
      {
        onSuccess: () => {
          setSuccessMessage('Fornecedor atualizado com sucesso!');
        },
      }
    );
  }

  if (isLoading) {
    return (
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
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {error.response?.status === 404
              ? 'Fornecedor não encontrado.'
              : 'Erro ao carregar fornecedor. Tente novamente.'}
          </p>
        </div>
        <Link href="/suppliers">
          <Button variant="outline">Voltar para lista</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Editar Fornecedor</h1>
        <Link href="/suppliers">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      {!supplier?.active && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-sm text-yellow-800">
            Este fornecedor está <strong>inativo</strong>.
          </p>
        </div>
      )}

      {supplier && (
        <SupplierForm
          initialData={{
            razaoSocial: supplier.razaoSocial,
            nomeFantasia: supplier.nomeFantasia,
            cnpj: applyCnpjMask(supplier.cnpj),
            contato: supplier.contato,
            endereco: supplier.endereco as Record<string, string> | null,
          }}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/suppliers')}
          isSubmitting={updateMutation.isPending}
          submitLabel="Salvar Alterações"
          error={
            updateMutation.error
              ? updateMutation.error.response?.data?.message ||
                'Erro ao atualizar fornecedor. Tente novamente.'
              : null
          }
          successMessage={successMessage || null}
        />
      )}
    </div>
  );
}
