'use client';

import { ParticleNetwork } from '@/components/effects/particle-network';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — dark with particle network */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-brand-dark via-brand-navy to-brand-teal lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Particle network animation */}
        <ParticleNetwork className="z-0" />

        {/* Content over particles */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/20 text-brand-gold font-bold text-xl">
              C
            </div>
            <div>
              <p className="text-sm font-bold text-white">RomaneioHub</p>
              <p className="text-xs text-brand-gold">GESTÃO DE PEDIDOS</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold leading-tight text-white">
            Sua gestão de compras com{' '}
            <span className="text-gradient-gold italic">controle total</span>{' '}
            em um só lugar.
          </h2>
          <p className="text-lg text-brand-muted">
            Gerencie fornecedores, produtos e pedidos com eficiência.
            Acompanhe gastos e notas fiscais em tempo real.
          </p>

          {/* Stats */}
          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-2xl font-bold text-brand-gold">+98%</p>
              <p className="text-xs uppercase tracking-wider text-brand-muted">Satisfação</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">24/7</p>
              <p className="text-xs uppercase tracking-wider text-brand-muted">Disponível</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">Multi-tenant</p>
              <p className="text-xs uppercase tracking-wider text-brand-muted">SaaS</p>
            </div>
          </div>
        </div>

        {/* Bottom status */}
        <div className="relative z-10 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse-slow" />
          <span className="text-sm text-brand-muted">
            Operação online — sincronizado agora
          </span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full flex-col items-center justify-center bg-brand-dark px-6 py-12 lg:w-1/2 lg:bg-brand-surface">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
