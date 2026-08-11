'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useResetPassword } from '@/hooks/use-auth';
import { validatePasswordStrength } from '@romaneio-hub/shared';

export default function ResetPasswordPage() {
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
      { email, code, newPassword },
      { onSuccess: () => setSuccess(true) }
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
          Insira o código de 6 dígitos e escolha uma nova senha.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input label="E-mail" name="email" type="email" autoComplete="email" placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input label="Código de verificação" name="code" type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} error={errors.code} />
        <Input label="Nova senha" name="newPassword" type="password" autoComplete="new-password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} error={errors.newPassword} />
        <p className="text-xs text-brand-muted">Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.</p>
        <Input label="Confirmar nova senha" name="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={errors.confirmPassword} />

        {resetPassword.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-400" role="alert">
              {resetPassword.error.response?.data?.message || 'Erro ao redefinir senha. Verifique o código e tente novamente.'}
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" loading={resetPassword.isPending}>
          Redefinir senha
        </Button>
      </form>

      <div className="text-center">
        <Link href="/login" className="text-sm text-brand-gold hover:text-brand-gold-hover font-medium transition-colors">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
