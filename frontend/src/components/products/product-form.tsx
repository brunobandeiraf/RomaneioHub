'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ProductFormData {
  nome: string;
  categoria: string;
  unidade: string;
  precoReferencia: number;
}

export interface ProductFormErrors {
  nome?: string;
  categoria?: string;
  unidade?: string;
  precoReferencia?: string;
}

interface ProductFormProps {
  initialData?: {
    nome: string;
    categoria: string;
    unidade: string;
    precoReferencia: string | number;
  };
  onSubmit: (data: ProductFormData) => Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  disabled?: boolean;
  apiError?: string;
  onCancel?: () => void;
}

export function ProductForm({
  initialData,
  onSubmit,
  isSubmitting,
  submitLabel,
  disabled = false,
  apiError,
  onCancel,
}: ProductFormProps) {
  const [nome, setNome] = useState(initialData?.nome || '');
  const [categoria, setCategoria] = useState(initialData?.categoria || '');
  const [unidade, setUnidade] = useState(initialData?.unidade || '');
  const [precoReferencia, setPrecoReferencia] = useState(() => {
    if (!initialData?.precoReferencia) return '';
    const num =
      typeof initialData.precoReferencia === 'string'
        ? parseFloat(initialData.precoReferencia)
        : initialData.precoReferencia;
    return isNaN(num) ? '' : num.toFixed(2).replace('.', ',');
  });
  const [errors, setErrors] = useState<ProductFormErrors>({});

  // Sync form when initialData changes (e.g., after fetch)
  useEffect(() => {
    if (initialData) {
      setNome(initialData.nome);
      setCategoria(initialData.categoria);
      setUnidade(initialData.unidade);
      const num =
        typeof initialData.precoReferencia === 'string'
          ? parseFloat(initialData.precoReferencia)
          : initialData.precoReferencia;
      setPrecoReferencia(isNaN(num) ? '' : num.toFixed(2).replace('.', ','));
    }
  }, [initialData]);

  const validate = useCallback((): boolean => {
    const newErrors: ProductFormErrors = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    } else if (nome.trim().length > 200) {
      newErrors.nome = 'Nome deve ter no máximo 200 caracteres';
    }

    if (!categoria.trim()) {
      newErrors.categoria = 'Categoria é obrigatória';
    } else if (categoria.trim().length > 100) {
      newErrors.categoria = 'Categoria deve ter no máximo 100 caracteres';
    }

    if (!unidade.trim()) {
      newErrors.unidade = 'Unidade é obrigatória';
    } else if (unidade.trim().length > 50) {
      newErrors.unidade = 'Unidade deve ter no máximo 50 caracteres';
    }

    if (!precoReferencia.trim()) {
      newErrors.precoReferencia = 'Preço de referência é obrigatório';
    } else {
      const value = parseFloat(precoReferencia.replace(',', '.'));
      if (isNaN(value)) {
        newErrors.precoReferencia = 'Preço inválido';
      } else if (value < 0.01) {
        newErrors.precoReferencia = 'Preço mínimo é R$ 0,01';
      } else if (value > 9999999999.99) {
        newErrors.precoReferencia = 'Preço máximo é R$ 9.999.999.999,99';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [nome, categoria, unidade, precoReferencia]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const preco = parseFloat(precoReferencia.replace(',', '.'));
    await onSubmit({
      nome: nome.trim(),
      categoria: categoria.trim(),
      unidade: unidade.trim(),
      precoReferencia: preco,
    });
  };

  const handlePrecoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^[\d.,]*$/.test(value)) {
      setPrecoReferencia(value);
    }
  };

  const handlePrecoBlur = () => {
    if (precoReferencia) {
      const value = parseFloat(precoReferencia.replace(',', '.'));
      if (!isNaN(value)) {
        setPrecoReferencia(value.toFixed(2).replace('.', ','));
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700">{apiError}</p>
        </div>
      )}

      <div className="space-y-4">
        <Input
          label="Nome *"
          name="nome"
          placeholder="Nome do produto"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          error={errors.nome}
          maxLength={200}
          disabled={disabled}
        />

        <Input
          label="Categoria *"
          name="categoria"
          placeholder="Ex: Alimentos, Limpeza, Escritório"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          error={errors.categoria}
          maxLength={100}
          disabled={disabled}
        />

        <Input
          label="Unidade *"
          name="unidade"
          placeholder="Ex: kg, un, cx, L"
          value={unidade}
          onChange={(e) => setUnidade(e.target.value)}
          error={errors.unidade}
          maxLength={50}
          disabled={disabled}
        />

        <div className="w-full">
          <label
            htmlFor="precoReferencia"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Preço de Referência (R$) *
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500">
              R$
            </span>
            <input
              id="precoReferencia"
              name="precoReferencia"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={precoReferencia}
              onChange={handlePrecoChange}
              onBlur={handlePrecoBlur}
              disabled={disabled}
              className={`w-full rounded-md border px-3 py-2 pl-9 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed ${
                errors.precoReferencia
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
              aria-invalid={!!errors.precoReferencia}
              aria-describedby={
                errors.precoReferencia ? 'precoReferencia-error' : undefined
              }
            />
          </div>
          {errors.precoReferencia && (
            <p
              id="precoReferencia-error"
              className="mt-1 text-sm text-red-600"
              role="alert"
            >
              {errors.precoReferencia}
            </p>
          )}
        </div>
      </div>

      {!disabled && (
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
