/**
 * The root of the console. Phase 0 shows the shell only. Routing, the
 * providers and the pages arrive in Phase 1.
 */
export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-2 px-8 py-16">
      <h1 className="text-2xl font-semibold">Trust Desk</h1>
      <p className="text-ink-muted">
        Trust and Safety investigation console. Synthetic data only.
      </p>
    </main>
  );
}
