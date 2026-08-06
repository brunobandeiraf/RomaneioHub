'use client';

import { Button } from '@/components/ui/button';
import { SubscriptionStatus } from '@/hooks/use-subscription';

const statusConfig: Record<
  SubscriptionStatus,
  { label: string; color: string; bgColor: string }
> = {
  TRIAL: {
    label: 'Trial',
    color: 'text-purple-800',
    bgColor: 'bg-purple-100',
  },
  ACTIVE: {
    label: 'Ativa',
    color: 'text-green-800',
    bgColor: 'bg-green-100',
  },
  PAST_DUE: {
    label: 'Pagamento Pendente',
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100',
  },
  GRACE_PERIOD: {
    label: 'Período de Carência',
    color: 'text-orange-800',
    bgColor: 'bg-orange-100',
  },
  BLOCKED: {
    label: 'Bloqueada',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
  },
  CANCELLED: {
    label: 'Cancelada',
    color: 'text-gray-800',
    bgColor: 'bg-gray-100',
  },
};

interface SubscriptionStatusCardProps {
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  onManageSubscription: () => void;
  isManageLoading: boolean;
  manageError?: string;
}

export function SubscriptionStatusCard({
  status,
  stripeCustomerId,
  onManageSubscription,
  isManageLoading,
  manageError,
}: SubscriptionStatusCardProps) {
  const statusInfo = statusConfig[status];

  return (
    <div className="rounded-md bg-white p-6 shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Status da Assinatura
      </h2>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Status atual:</span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}
        >
          {statusInfo.label}
        </span>
      </div>

      {stripeCustomerId && (
        <div className="mt-6">
          <Button
            onClick={onManageSubscription}
            variant="outline"
            loading={isManageLoading}
          >
            Gerenciar Assinatura
          </Button>
          {manageError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {manageError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
