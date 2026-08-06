'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useResetPassword } from '@/hooks/use-auth';
import { validatePasswordStrength } from '@compras-hub/shared';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetPassword = useResetPassword();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (!code) {
      newErrors.code = 'Código é obrigatório';
    } else if (!/^\d{6}$/.test(code)) {
      newErrors.code = 'Código deve ter 6 dígitos';
    }

    if (!newPassword) {
      newErrors.newPassword = 'Nova senha é obrigatória';
    } else {
      const passwordResult = validatePasswordStrength(newPassword);
      if (!passwordResult.valid) {
        newErrors.newPassword = passwordResult.errors[0];
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmação de senha é obrigatória';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    resetPassword.mutate(
      { email, code, newPassword },
      {
        onSuccess: () => {
          setSuccess(true);
        },
      }
    );
  }

  if (success) {
    return (
      <div className="mt-8 rounded-md bg-white p-6 shadow-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Senha alterada!</h2>
        <p className="text-sm text-gray-600">
          Sua senha foi alterada com sucesso. Você já pode fazer login.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
      <div className="space-y-4 rounded-md bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Redefinir senha
        </h2>
        <p className="text-sm text-gray-600">
          Insira o código de 6 dígitos enviado para seu e-mail e escolha uma nova
          senha.
        </p>

        <Input
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <Input
          label="Código de verificação"
          name="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          error={errors.code}
        />

        <Input
          label="Nova senha"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.newPassword}
        />
        <p className="text-xs text-gray-500">
          Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.
        </p>

        <Input
          label="Confirmar nova senha"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
        />

        {resetPassword.error && (
          <p className="text-sm text-red-600" role="alert">
            {resetPassword.error.response?.data?.message ||
              'Erro ao redefinir senha. Verifique o código e tente novamente.'}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={resetPassword.isPending}
        >
          Redefinir senha
        </Button>
      </div>

      <div className="text-center text-sm">
        <Link href="/login" className="text-blue-600 hover:text-blue-500">
          Voltar para o login
        </Link>
      </div>
    </form>
  );
}
