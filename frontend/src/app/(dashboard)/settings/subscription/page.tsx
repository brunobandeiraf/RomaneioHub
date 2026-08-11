'use client';

import { Button } from '@/components/ui/button';
import { GracePeriodBanner } from '@/components/settings/grace-period-banner';
import { SubscriptionStatusCard } from '@/components/settings/subscription-status-card';
import {
  useSubscriptionStatus,
  useCreateCheckout,
  usePortalUrl,
} from '@/hooks/use-subscription';

function getGracePeriodDaysLeft(gracePeriodEnd?: string): number | null {
  if (!gracePeriodEnd) return null;
  const end = new Date(gracePeriodEnd);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

export default function SubscriptionPage() {
  const { data: subscription, isLoading, error } = useSubscriptionStatus();
  const checkoutMutation = useCreateCheckout();
  const portalMutation = usePortalUrl();

  const isGracePeriod = subscription?.status === 'GRACE_PERIOD';
  const daysLeft = getGracePeriodDaysLeft(subscription?.gracePeriodEnd);

  function handleManageSubscription() {
    portalMutation.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.portalUrl;
      },
    });
  }

  function handleCheckout(planType: 'monthly' | 'annual') {
    checkoutMutation.mutate(
      { planType },
      {
        onSuccess: (data) => {
          window.location.href = data.checkoutUrl;
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" role="status">
          <span className="sr-only">Carregando...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">
          Erro ao carregar informações da assinatura. Tente novamente mais tarde.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grace Period Banner */}
      {isGracePeriod && <GracePeriodBanner daysLeft={daysLeft} />}

      {/* Current Status Card */}
      {subscription && (
        <SubscriptionStatusCard
          status={subscription.status}
          stripeCustomerId={subscription.stripeCustomerId}
          onManageSubscription={handleManageSubscription}
          isManageLoading={portalMutation.isPending}
          manageError={
            portalMutation.error?.response?.data?.message ||
            (portalMutation.error ? 'Erro ao abrir portal. Tente novamente.' : undefined)
          }
        />
      )}

      {/* Plan Selection */}
      <div className="rounded-md bg-white p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Assinar Plano
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Escolha o plano que melhor se adapta às suas necessidades.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Monthly Plan */}
          <div className="rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors">
            <h3 className="text-base font-semibold text-gray-900">Mensal</h3>
            <p className="mt-1 text-sm text-gray-500">
              Flexibilidade para pagar mês a mês
            </p>
            <div className="mt-4">
              <Button
                onClick={() => handleCheckout('monthly')}
                className="w-full"
                loading={
                  checkoutMutation.isPending &&
                  checkoutMutation.variables?.planType === 'monthly'
                }
                disabled={checkoutMutation.isPending}
              >
                Assinar Mensal
              </Button>
            </div>
          </div>

          {/* Annual Plan */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 relative">
            <span className="absolute -top-2.5 left-4 inline-flex items-center rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white">
              Melhor valor
            </span>
            <h3 className="text-base font-semibold text-gray-900">Anual</h3>
            <p className="mt-1 text-sm text-gray-500">
              Economia com pagamento antecipado
            </p>
            <div className="mt-4">
              <Button
                onClick={() => handleCheckout('annual')}
                className="w-full"
                loading={
                  checkoutMutation.isPending &&
                  checkoutMutation.variables?.planType === 'annual'
                }
                disabled={checkoutMutation.isPending}
              >
                Assinar Anual
              </Button>
            </div>
          </div>
        </div>

        {checkoutMutation.error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {checkoutMutation.error.response?.data?.message ||
              'Erro ao iniciar checkout. Tente novamente.'}
          </p>
        )}
      </div>
    </div>
  );
}
