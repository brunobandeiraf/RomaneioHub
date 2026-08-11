'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForgotPassword } from '@/hooks/use-auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const forgotPassword = useForgotPassword();

  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [success, setSuccess] = useState(false);

  function validate(): boolean {
    const newErrors: { email?: string } = {};
    if (!email) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'E-mail inválido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    forgotPassword.mutate(
      { email },
      { onSuccess: () => setSuccess(true) }
    );
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/20">
          <svg className="h-6 w-6 text-brand-gold" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Código enviado!</h2>
        <p className="text-sm text-brand-muted">
          Se o e-mail <strong className="text-white">{email}</strong> estiver cadastrado,
          você receberá um código de 6 dígitos válido por 15 minutos.
        </p>
        <Button
          className="w-full"
          onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
        >
          Inserir código
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white">Recuperar senha</h2>
        <p className="mt-2 text-sm text-brand-muted">
          Informe seu e-mail e enviaremos um código de verificação.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input label="E-mail corporativo" name="email" type="email" autoComplete="email" placeholder="voce@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />

        {forgotPassword.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-400" role="alert">
              {forgotPassword.error.response?.data?.message || 'Erro ao enviar código. Tente novamente.'}
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" loading={forgotPassword.isPending}>
          Enviar código
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
