export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-dark">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
