'use client';

import { FormEvent, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface InviteFormProps {
  onSubmit: (data: {
    email: string;
    role: 'ACCOUNTING_MANAGER' | 'ACCOUNTING_VIEWER';
  }) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
  isSuccess?: boolean;
}

export function InviteForm({
  onSubmit,
  onCancel,
  isLoading,
  error,
  isSuccess,
}: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ACCOUNTING_MANAGER' | 'ACCOUNTING_VIEWER'>(
    'ACCOUNTING_MANAGER'
  );
  const [formErrors, setFormErrors] = useState<{ email?: string }>({});

  function validate(): boolean {
    const errors: { email?: string } = {};
    if (!email) {
      errors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'E-mail inválido';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ email, role });
  }

  return (
    <div className="rounded-md bg-white p-6 shadow-sm border border-gray-200">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Convidar Contador
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="E-mail do contador"
          name="invite-email"
          type="email"
          placeholder="contador@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={formErrors.email}
        />

        <div className="w-full">
          <label
            htmlFor="invite-role"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Perfil de acesso
          </label>
          <select
            id="invite-role"
            name="invite-role"
            value={role}
            onChange={(e) =>
              setRole(
                e.target.value as 'ACCOUNTING_MANAGER' | 'ACCOUNTING_VIEWER'
              )
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ACCOUNTING_MANAGER">
              Contabilidade - Gestão
            </option>
            <option value="ACCOUNTING_VIEWER">
              Contabilidade - Visualização
            </option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Gestão: pode cadastrar e editar. Visualização: somente leitura.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={isLoading}>
            Enviar Convite
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {isSuccess && (
          <p className="text-sm text-green-600" role="status">
            Convite enviado com sucesso!
          </p>
        )}
      </form>
    </div>
  );
}
