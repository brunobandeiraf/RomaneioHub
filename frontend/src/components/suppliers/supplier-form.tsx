'use client';

import { FormEvent, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CnpjInput } from '@/components/ui/cnpj-input';
import { validateCnpj } from '../../lib/shared';

export interface SupplierFormData {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  contato?: string;
  endereco?: Record<string, string>;
}

export interface SupplierFormProps {
  initialData?: {
    razaoSocial: string;
    nomeFantasia?: string | null;
    cnpj: string;
    contato?: string | null;
    endereco?: Record<string, string> | null;
  };
  onSubmit: (data: SupplierFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  error?: string | null;
  successMessage?: string | null;
}

interface FormErrors {
  razaoSocial?: string;
  cnpj?: string;
}

export function SupplierForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Salvar',
  error,
  successMessage,
}: SupplierFormProps) {
  const [razaoSocial, setRazaoSocial] = useState(initialData?.razaoSocial || '');
  const [nomeFantasia, setNomeFantasia] = useState(initialData?.nomeFantasia || '');
  const [cnpj, setCnpj] = useState(initialData?.cnpj || '');
  const [contato, setContato] = useState(initialData?.contato || '');
  const [endereco, setEndereco] = useState({
    logradouro: initialData?.endereco?.logradouro || '',
    numero: initialData?.endereco?.numero || '',
    complemento: initialData?.endereco?.complemento || '',
    bairro: initialData?.endereco?.bairro || '',
    cidade: initialData?.endereco?.cidade || '',
    estado: initialData?.endereco?.estado || '',
    cep: initialData?.endereco?.cep || '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const handleCnpjChange = useCallback((value: string) => {
    setCnpj(value);
  }, []);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!razaoSocial.trim()) {
      newErrors.razaoSocial = 'Razão social é obrigatória';
    } else if (razaoSocial.trim().length > 255) {
      newErrors.razaoSocial = 'Razão social deve ter no máximo 255 caracteres';
    }

    if (!cnpj.trim()) {
      newErrors.cnpj = 'CNPJ é obrigatório';
    } else if (!validateCnpj(cnpj)) {
      newErrors.cnpj = 'CNPJ inválido. Verifique os dígitos informados.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const cleanedCnpj = cnpj.replace(/\D/g, '');
    const enderecoData = Object.values(endereco).some((v) => v.trim())
      ? endereco
      : undefined;

    onSubmit({
      razaoSocial: razaoSocial.trim(),
      nomeFantasia: nomeFantasia.trim() || undefined,
      cnpj: cleanedCnpj,
      contato: contato.trim() || undefined,
      endereco: enderecoData,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Dados do Fornecedor</h2>

        <div className="space-y-4">
          <Input
            label="Razão Social *"
            name="razaoSocial"
            placeholder="Razão social da empresa"
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
            error={errors.razaoSocial}
            maxLength={255}
          />

          <Input
            label="Nome Fantasia"
            name="nomeFantasia"
            placeholder="Nome fantasia (opcional)"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            maxLength={255}
          />

          <CnpjInput
            value={cnpj}
            onChange={handleCnpjChange}
            error={errors.cnpj}
          />

          <Input
            label="Contato"
            name="contato"
            placeholder="Telefone ou e-mail de contato"
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            maxLength={255}
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Endereço (opcional)</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Logradouro"
              name="logradouro"
              placeholder="Rua, Avenida, etc."
              value={endereco.logradouro}
              onChange={(e) => setEndereco((prev) => ({ ...prev, logradouro: e.target.value }))}
            />
          </div>

          <Input
            label="Número"
            name="numero"
            placeholder="Nº"
            value={endereco.numero}
            onChange={(e) => setEndereco((prev) => ({ ...prev, numero: e.target.value }))}
          />

          <Input
            label="Complemento"
            name="complemento"
            placeholder="Sala, Andar, etc."
            value={endereco.complemento}
            onChange={(e) => setEndereco((prev) => ({ ...prev, complemento: e.target.value }))}
          />

          <Input
            label="Bairro"
            name="bairro"
            placeholder="Bairro"
            value={endereco.bairro}
            onChange={(e) => setEndereco((prev) => ({ ...prev, bairro: e.target.value }))}
          />

          <Input
            label="Cidade"
            name="cidade"
            placeholder="Cidade"
            value={endereco.cidade}
            onChange={(e) => setEndereco((prev) => ({ ...prev, cidade: e.target.value }))}
          />

          <Input
            label="Estado"
            name="estado"
            placeholder="UF"
            value={endereco.estado}
            onChange={(e) => setEndereco((prev) => ({ ...prev, estado: e.target.value }))}
          />

          <Input
            label="CEP"
            name="cep"
            placeholder="00000-000"
            value={endereco.cep}
            onChange={(e) => setEndereco((prev) => ({ ...prev, cep: e.target.value }))}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        </div>
      )}

      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-700" role="status">
            {successMessage}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
