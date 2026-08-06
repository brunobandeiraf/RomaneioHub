'use client';

interface GracePeriodBannerProps {
  daysLeft: number | null;
}

export function GracePeriodBanner({ daysLeft }: GracePeriodBannerProps) {
  return (
    <div
      className="rounded-md bg-orange-50 border border-orange-200 p-4"
      role="alert"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-orange-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-orange-800">
            Assinatura cancelada. Dados em modo leitura.
          </h3>
          {daysLeft !== null && (
            <p className="mt-1 text-sm text-orange-700">
              Sua assinatura expira em {daysLeft}{' '}
              {daysLeft === 1 ? 'dia' : 'dias'}. Renove para manter o acesso
              completo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
