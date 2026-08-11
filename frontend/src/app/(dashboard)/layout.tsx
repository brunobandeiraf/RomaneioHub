'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

const mainNavigation = [
  { name: 'Home', href: '/', icon: '🏠' },
  { name: 'Produtos', href: '/products', icon: '📋' },
  { name: 'Pedidos', href: '/orders', icon: '📦' },
  { name: 'Fornecedores', href: '/suppliers', icon: '🏢' },
];

const bottomNavigation = [
  { name: 'Assinatura', href: '/settings/subscription', icon: '💳' },
  { name: 'Equipe', href: '/settings/team', icon: '👥' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-dark">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-border border-t-brand-gold" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const isSeller = user?.role === 'SELLER' || user?.role === 'ADMIN';
  const d = darkMode; // shorthand

  return (
    <div data-theme={d ? 'dark' : 'light'} className={`min-h-screen flex ${d ? 'bg-brand-dark' : 'bg-[#f0f2f5]'}`}>
      {/* Sidebar */}
      <aside
        className={`sticky top-0 h-screen flex flex-col justify-between transition-all duration-300 ${
          sidebarExpanded ? 'w-60' : 'w-[72px]'
        } ${d ? 'bg-gradient-to-b from-[#0c1a2e] to-[#0a1628]' : 'bg-white border-r border-gray-200'}`}
      >
        {/* Top: Logo */}
        <div>
          <div className={`flex items-center gap-3 px-4 py-5 ${sidebarExpanded ? '' : 'justify-center'}`}>
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg font-bold text-base ${d ? 'bg-brand-gold/20 text-brand-gold' : 'bg-blue-100 text-blue-700'}`}>
              R
            </div>
            {sidebarExpanded && (
              <span className={`text-sm font-bold tracking-wide ${d ? 'text-white' : 'text-gray-900'}`}>
                RomaneioHub
              </span>
            )}
          </div>

          {/* Main navigation */}
          <nav className="flex flex-col gap-1 px-3 mt-4">
            {mainNavigation.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.name}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    sidebarExpanded ? '' : 'justify-center'
                  } ${
                    isActive
                      ? d
                        ? 'bg-brand-gold/15 text-brand-gold shadow-sm shadow-brand-gold/10'
                        : 'bg-blue-50 text-blue-700 shadow-sm'
                      : d
                        ? 'text-[#7b8fa8] hover:bg-white/5 hover:text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  {sidebarExpanded && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom section */}
        <div className="px-3 pb-4">
          {/* Settings nav */}
          {isSeller && sidebarExpanded && (
            <div className="mb-4">
              <p className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest ${d ? 'text-[#4a5d75]' : 'text-gray-400'}`}>
                Configurações
              </p>
              {bottomNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? d ? 'bg-brand-gold/15 text-brand-gold' : 'bg-blue-50 text-blue-700'
                        : d ? 'text-[#7b8fa8] hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {isSeller && !sidebarExpanded && (
            <div className="mb-4 flex flex-col gap-1">
              {bottomNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    className={`flex items-center justify-center rounded-xl px-3 py-2 text-sm transition-all ${
                      isActive
                        ? d ? 'bg-brand-gold/15 text-brand-gold' : 'bg-blue-50 text-blue-700'
                        : d ? 'text-[#7b8fa8] hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* User info — click to collapse/expand */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            title={sidebarExpanded ? 'Recolher menu' : 'Expandir menu'}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all ${sidebarExpanded ? '' : 'justify-center'} ${d ? 'bg-white/[0.03] hover:bg-white/[0.06]' : 'bg-gray-50 hover:bg-gray-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 flex-shrink-0 ${d ? 'text-[#7b8fa8]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {sidebarExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h8.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              )}
            </svg>
            {sidebarExpanded && (
              <div className="min-w-0 flex-1 text-left">
                <p className={`text-sm font-medium truncate ${d ? 'text-white' : 'text-gray-900'}`}>
                  {user?.name || 'Usuário'}
                </p>
                <p className={`text-[10px] truncate uppercase tracking-wide ${d ? 'text-[#5a7090]' : 'text-gray-500'}`}>
                  {user?.email}
                </p>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className={`sticky top-0 z-30 border-b backdrop-blur-md px-6 py-3 flex items-center justify-end ${d ? 'bg-brand-dark/90 border-brand-border' : 'bg-white/90 border-gray-200'}`}>
          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Modo claro' : 'Modo escuro'}
              className={`p-2 rounded-lg transition-colors ${d ? 'text-[#7b8fa8] hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
            >
              {d ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
            {/* Logout button */}
            <button
              onClick={logout}
              title="Sair"
              className={`p-2 rounded-lg transition-colors ${d ? 'text-[#7b8fa8] hover:text-red-400 hover:bg-red-500/10' : 'text-gray-500 hover:text-red-600 hover:bg-red-50'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className={`flex-1 p-6 ${d ? 'bg-[#0e1a2d]' : 'bg-[#f0f2f5]'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
