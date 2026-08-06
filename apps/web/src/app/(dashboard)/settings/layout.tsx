'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

const tabs = [
  { label: 'Assinatura', href: '/settings/subscription' },
  { label: 'Equipe', href: '/settings/team' },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Only SELLER role can access settings pages
  useEffect(() => {
    if (!isLoading && user && user.role !== 'SELLER') {
      router.push('/');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" role="status">
          <span className="sr-only">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'SELLER') {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h1>

      <nav className="border-b border-gray-200 mb-8" aria-label="Configurações">
        <ul className="flex -mb-px space-x-8" role="tablist">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <li key={tab.href} role="presentation">
                <Link
                  href={tab.href}
                  role="tab"
                  aria-selected={isActive}
                  className={`inline-block pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {children}
    </div>
  );
}
