'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

const benefits = [
  {
    icon: '📦',
    title: 'Gestão completa de pedidos',
    description: 'Crie, acompanhe e gerencie todos os pedidos de compra em um só lugar.',
  },
  {
    icon: '🏢',
    title: 'Controle de fornecedores',
    description: 'Cadastre fornecedores com CNPJ validado e histórico de preços por produto.',
  },
  {
    icon: '📄',
    title: 'Notas fiscais na nuvem',
    description: 'Anexe e armazene notas fiscais com segurança no S3 da AWS.',
  },
  {
    icon: '📊',
    title: 'Dashboard analítico',
    description: 'Acompanhe gastos, evolução mensal e top fornecedores em tempo real.',
  },
  {
    icon: '👥',
    title: 'Multi-usuários',
    description: 'Convide sua contabilidade com permissões personalizadas (gestão ou visualização).',
  },
  {
    icon: '🔒',
    title: 'Segurança enterprise',
    description: 'Multi-tenant com isolamento total, MFA para admins e criptografia de dados.',
  },
];

const plans = [
  {
    id: 'monthly',
    name: 'Mensal',
    badge: null,
    pricePerMonth: 29.90,
    billingCycle: 1,
    description: 'Pague mês a mês, cancele quando quiser.',
  },
  {
    id: 'semiannual',
    name: 'Semestral',
    badge: 'Popular',
    pricePerMonth: 19.90,
    billingCycle: 6,
    description: 'Economia de 33% em relação ao mensal.',
  },
  {
    id: 'annual',
    name: 'Anual',
    badge: 'Melhor valor',
    pricePerMonth: 14.90,
    billingCycle: 12,
    description: 'Máxima economia — 50% off no valor mensal.',
  },
];

export default function RegisterPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectPlan(planId: string) {
    setLoadingPlan(planId);
    setError(null);

    try {
      // For now, redirect to Stripe checkout. In production, this would
      // first create the account, then redirect to payment.
      const response = await apiClient.post('/subscriptions/checkout', {
        planType: planId,
      });
      // Redirect to Stripe Checkout
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        setError('Erro ao redirecionar para o pagamento. Tente novamente.');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; statusCode?: number } } };
      if (axiosErr?.response?.data?.statusCode === 401) {
        // User not authenticated — store selected plan and redirect to a signup+payment flow
        localStorage.setItem('selected_plan', planId);
        setError('Você precisa criar sua conta primeiro. Redirecionando...');
        // In a full implementation, this would show an inline signup form
        // For now, show the error
      } else {
        setError(
          axiosErr?.response?.data?.message ||
            'Erro ao processar. Tente novamente.'
        );
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="space-y-10 py-4">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">
          Comece a usar o <span className="text-gradient-gold">RomaneioHub</span>
        </h2>
        <p className="mt-3 text-brand-muted max-w-md mx-auto">
          Escolha o plano ideal para sua empresa e tenha acesso completo a todas as funcionalidades.
        </p>
      </div>

      {/* Benefits grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {benefits.map((benefit) => (
          <div
            key={benefit.title}
            className="flex gap-3 rounded-lg border border-brand-border bg-brand-surface-light/50 p-4 transition-colors hover:border-brand-gold/30"
          >
            <span className="text-2xl flex-shrink-0">{benefit.icon}</span>
            <div>
              <p className="text-sm font-medium text-white">{benefit.title}</p>
              <p className="mt-0.5 text-xs text-brand-muted">{benefit.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Plans */}
      <div>
        <h3 className="text-center text-lg font-semibold text-white mb-6">
          Escolha seu plano
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const totalPrice = plan.pricePerMonth * plan.billingCycle;
            const isLoading = loadingPlan === plan.id;
            const isAnnual = plan.id === 'annual';

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border p-6 transition-all ${
                  isAnnual
                    ? 'border-brand-gold bg-brand-gold/5 shadow-lg shadow-brand-gold/10'
                    : 'border-brand-border bg-brand-surface-light/30 hover:border-brand-gold/40'
                }`}
              >
                {plan.badge && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold ${
                      isAnnual
                        ? 'bg-brand-gold text-brand-dark'
                        : 'bg-brand-surface-light text-brand-gold border border-brand-gold/30'
                    }`}
                  >
                    {plan.badge}
                  </span>
                )}

                <div className="text-center mb-4 mt-2">
                  <p className="text-sm font-medium text-brand-muted">{plan.name}</p>
                  <div className="mt-2 flex items-baseline justify-center gap-1">
                    <span className="text-sm text-brand-muted">R$</span>
                    <span className="text-4xl font-bold text-white">
                      {plan.pricePerMonth.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-sm text-brand-muted">/mês</span>
                  </div>
                </div>

                <p className="text-center text-xs text-brand-muted mb-4">
                  {plan.description}
                </p>

                {/* Total */}
                <div className="rounded-lg bg-brand-dark/50 p-3 text-center mb-5">
                  <p className="text-xs text-brand-muted">Total cobrado</p>
                  <p className="text-lg font-bold text-white">
                    R$ {totalPrice.toFixed(2).replace('.', ',')}
                    <span className="text-xs font-normal text-brand-muted">
                      {plan.billingCycle === 1 && ' /mês'}
                      {plan.billingCycle === 6 && ' /semestre'}
                      {plan.billingCycle === 12 && ' /ano'}
                    </span>
                  </p>
                </div>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={!!loadingPlan}
                  className={`mt-auto w-full rounded-lg py-3 text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    isAnnual
                      ? 'bg-brand-gold text-brand-dark hover:bg-brand-gold-hover hover:shadow-lg hover:shadow-brand-gold/20'
                      : 'bg-brand-surface-light text-white border border-brand-border hover:bg-brand-border hover:border-brand-gold/40'
                  }`}
                >
                  {isLoading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <>
                      Assinar agora
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center space-y-2">
        <p className="text-xs text-brand-muted">
          Pagamento seguro via Stripe. Cancele a qualquer momento.
        </p>
        <p className="text-sm text-brand-muted">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-brand-gold hover:text-brand-gold-hover font-medium transition-colors">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
