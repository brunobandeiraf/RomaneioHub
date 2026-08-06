'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InviteForm } from '@/components/settings/invite-form';
import { useAuth } from '@/lib/auth-context';
import {
  useTeamMembers,
  useInviteAccountant,
  useResendInvite,
  useRevokeAccess,
  TeamMember,
  TenantRole,
} from '@/hooks/use-team';

const roleLabels: Record<TenantRole, string> = {
  SELLER: 'Proprietário',
  ACCOUNTING_MANAGER: 'Contabilidade - Gestão',
  ACCOUNTING_VIEWER: 'Contabilidade - Visualização',
};

const statusLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: 'Pendente', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
  ACCEPTED: { label: 'Ativo', color: 'text-green-800', bgColor: 'bg-green-100' },
  REVOKED: { label: 'Revogado', color: 'text-red-800', bgColor: 'bg-red-100' },
};

export default function TeamPage() {
  const { user } = useAuth();
  const { data: members, isLoading, error } = useTeamMembers();
  const inviteMutation = useInviteAccountant();
  const resendMutation = useResendInvite();
  const revokeMutation = useRevokeAccess();

  const [showInviteForm, setShowInviteForm] = useState(false);

  const isSeller = user?.role === 'SELLER';

  function handleInviteSubmit(data: {
    email: string;
    role: 'ACCOUNTING_MANAGER' | 'ACCOUNTING_VIEWER';
  }) {
    inviteMutation.mutate(data, {
      onSuccess: () => {
        setShowInviteForm(false);
      },
    });
  }

  function handleResend(memberId: string) {
    resendMutation.mutate({ memberId });
  }

  function handleRevoke(memberId: string) {
    if (window.confirm('Tem certeza que deseja revogar o acesso deste membro?')) {
      revokeMutation.mutate({ memberId });
    }
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
          Erro ao carregar membros da equipe. Tente novamente mais tarde.
        </p>
      </div>
    );
  }

  const activeMembers = members?.filter((m) => m.status === 'ACCEPTED') || [];
  const pendingMembers = members?.filter((m) => m.status === 'PENDING') || [];

  return (
    <div className="space-y-6">
      {/* Header with invite button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Membros da Equipe
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie os membros com acesso ao seu tenant.
          </p>
        </div>
        {isSeller && (
          <Button onClick={() => setShowInviteForm(!showInviteForm)}>
            Convidar Contador
          </Button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && isSeller && (
        <InviteForm
          onSubmit={handleInviteSubmit}
          onCancel={() => setShowInviteForm(false)}
          isLoading={inviteMutation.isPending}
          error={
            inviteMutation.error?.response?.data?.message ||
            (inviteMutation.error ? 'Erro ao enviar convite. Tente novamente.' : undefined)
          }
          isSuccess={inviteMutation.isSuccess}
        />
      )}

      {/* Pending Invitations */}
      {pendingMembers.length > 0 && (
        <div className="rounded-md bg-white p-6 shadow-sm border border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Convites Pendentes
          </h3>
          <ul className="divide-y divide-gray-100" role="list">
            {pendingMembers.map((member) => (
              <TeamMemberRow
                key={member.id}
                member={member}
                isSeller={isSeller}
                onResend={handleResend}
                onRevoke={handleRevoke}
                isResending={resendMutation.isPending}
                isRevoking={revokeMutation.isPending}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Active Members */}
      <div className="rounded-md bg-white p-6 shadow-sm border border-gray-200">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Membros Ativos
        </h3>
        {activeMembers.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum membro na equipe ainda. Convide um contador para começar.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100" role="list">
            {activeMembers.map((member) => (
              <TeamMemberRow
                key={member.id}
                member={member}
                isSeller={isSeller}
                onResend={handleResend}
                onRevoke={handleRevoke}
                isResending={resendMutation.isPending}
                isRevoking={revokeMutation.isPending}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TeamMemberRow({
  member,
  isSeller,
  onResend,
  onRevoke,
  isResending,
  isRevoking,
}: {
  member: TeamMember;
  isSeller: boolean;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
  isResending: boolean;
  isRevoking: boolean;
}) {
  const statusInfo = statusLabels[member.status] || statusLabels.PENDING;

  return (
    <li className="flex items-center justify-between py-4">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {member.name || member.email}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
        </div>
        <span className="text-sm text-gray-500">{member.email}</span>
        <span className="text-xs text-gray-400">
          {roleLabels[member.role]}
        </span>
      </div>

      {isSeller && member.role !== 'SELLER' && (
        <div className="flex items-center gap-2">
          {member.status === 'PENDING' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResend(member.id)}
              loading={isResending}
            >
              Reenviar
            </Button>
          )}
          {member.status !== 'REVOKED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRevoke(member.id)}
              loading={isRevoking}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Revogar
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
