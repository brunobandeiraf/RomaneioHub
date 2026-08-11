'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useResetPassword } from '@/hooks/use-auth';
import { validatePasswordStrength } from '@romaneio-hub/shared';

export default function ResetPasswordPage() {
  const resetPassword = useResetPassword();

  // Supabase sends access_token in the URL hash after the user clicks the reset link:
  // /reset-password#access_token=...&refresh_token=...&type=recovery
  const [accessToken, setAccessToken] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  // Extract access_token from URL hash on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const type = params.get('type');

    if (!token || type !== 'recovery') {
      setTokenError('Link inválido ou expirado. Solicite um novo link de recuperação.');
    } else {
      setAccessToken(token);
    }
  }, []);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!newPassword) {
      newErrors.newPassword = 'Nova senha é obrigatória';
    } else {
      const result = validatePasswordStrength(newPassword);
      if (!result.valid) newErrors.newPassword = result.errors[0];
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmação é obrigatória';
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
      { accessToken, newPassword },
      { onSuccess: () => setSuccess(true) }
    );
  }

  if (tokenError) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
          <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Link inválido</h2>
        <p className="text-sm text-brand-muted">{tokenError}</p>
        <Link
          href="/forgot-password"
          className="inline-block rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-medium text-brand-dark hover:bg-brand-gold-hover transition-all"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
          <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Senha alterada!</h2>
        <p className="text-sm text-brand-muted">
          Sua senha foi alterada com sucesso. Você já pode fazer login.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-medium text-brand-dark hover:bg-brand-gold-hover transition-all"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white">Redefinir senha</h2>
        <p className="mt-2 text-sm text-brand-muted">
          Escolha uma nova senha para sua conta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
        <p className="text-xs text-brand-muted">
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
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-400" role="alert">
              {(resetPassword.error as any).response?.data?.message ||
                'Erro ao redefinir senha. O link pode ter expirado.'}
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" loading={resetPassword.isPending}>
          Redefinir senha
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-brand-gold hover:text-brand-gold-hover font-medium transition-colors"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
