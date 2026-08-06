'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SupplierForm, SupplierFormData } from '@/components/suppliers/supplier-form';
import { useCreateSupplier } from '../hooks/use-suppliers';

export default function NewSupplierPage() {
  const router = useRouter();
  const createMutation = useCreateSupplier();

  function handleSubmit(data: SupplierFormData) {
    createMutation.mutate(
      {
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        cnpj: data.cnpj,
        contato: data.contato,
        endereco: data.endereco,
      },
      {
        onSuccess: () => {
          router.push('/suppliers');
        },
      }
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Novo Fornecedor</h1>
        <Link href="/suppliers">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <SupplierForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/suppliers')}
        isSubmitting={createMutation.isPending}
        submitLabel="Cadastrar Fornecedor"
        error={
          createMutation.error
            ? createMutation.error.response?.data?.message ||
              'Erro ao cadastrar fornecedor. Tente novamente.'
            : null
        }
      />
    </div>
  );
}
