'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLogin } from '@/hooks/use-auth';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate(): boolean {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (!password) {
      newErrors.password = 'Senha é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          router.push('/');
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
      <div className="space-y-4 rounded-md bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Entrar</h2>

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
          label="Senha"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        {login.error && (
          <p className="text-sm text-red-600" role="alert">
            {login.error.response?.data?.message || 'Erro ao fazer login. Tente novamente.'}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={login.isPending}
        >
          Entrar
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link
          href="/forgot-password"
          className="text-blue-600 hover:text-blue-500"
        >
          Esqueceu a senha?
        </Link>
        <Link href="/register" className="text-blue-600 hover:text-blue-500">
          Criar conta
        </Link>
      </div>
    </form>
  );
}
