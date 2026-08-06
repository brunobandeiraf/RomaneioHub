'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRegister } from '@/hooks/use-auth';
import { validatePasswordStrength } from '@compras-hub/shared';

export default function RegisterPage() {
  const register = useRegister();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!email) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (!companyName.trim()) {
      newErrors.companyName = 'Nome da empresa é obrigatório';
    }

    if (!password) {
      newErrors.password = 'Senha é obrigatória';
    } else {
      const passwordResult = validatePasswordStrength(password);
      if (!passwordResult.valid) {
        newErrors.password = passwordResult.errors[0];
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirmação de senha é obrigatória';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    register.mutate(
      { name, email, companyName, password },
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
        <h2 className="text-xl font-semibold text-gray-900">Conta criada!</h2>
        <p className="text-sm text-gray-600">
          Enviamos um e-mail de confirmação para <strong>{email}</strong>.
          Verifique sua caixa de entrada para ativar sua conta.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-blue-600 hover:text-blue-500"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
      <div className="space-y-4 rounded-md bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Criar Conta</h2>

        <Input
          label="Nome completo"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

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
          label="Nome da empresa"
          name="companyName"
          type="text"
          autoComplete="organization"
          placeholder="Sua empresa"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          error={errors.companyName}
        />

        <Input
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <p className="text-xs text-gray-500">
          Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.
        </p>

        <Input
          label="Confirmar senha"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
        />

        {register.error && (
          <p className="text-sm text-red-600" role="alert">
            {register.error.response?.data?.message ||
              'Erro ao criar conta. Tente novamente.'}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={register.isPending}
        >
          Criar conta
        </Button>
      </div>

      <div className="text-center text-sm">
        <span className="text-gray-600">Já tem uma conta? </span>
        <Link href="/login" className="text-blue-600 hover:text-blue-500">
          Entrar
        </Link>
      </div>
    </form>
  );
}
