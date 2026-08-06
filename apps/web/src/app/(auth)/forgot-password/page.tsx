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
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <svg
            className="h-6 w-6 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Código enviado!</h2>
        <p className="text-sm text-gray-600">
          Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá
          um código de 6 dígitos válido por 15 minutos.
        </p>
        <Button
          variant="primary"
          className="w-full"
          onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
        >
          Inserir código
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
      <div className="space-y-4 rounded-md bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Recuperar senha
        </h2>
        <p className="text-sm text-gray-600">
          Informe seu e-mail e enviaremos um código de verificação.
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

        {forgotPassword.error && (
          <p className="text-sm text-red-600" role="alert">
            {forgotPassword.error.response?.data?.message ||
              'Erro ao enviar código. Tente novamente.'}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={forgotPassword.isPending}
        >
          Enviar código
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
