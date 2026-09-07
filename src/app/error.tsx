"use client";

export default function ApplicationError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-6">
      <section className="card w-full max-w-md p-8" aria-labelledby="error-title">
        <p className="text-sm font-bold text-[var(--teal)]">King’s Accounting</p>
        <h1 id="error-title" className="display mt-3 text-2xl font-extrabold">We couldn’t load this page</h1>
        <p role="alert" className="mt-4 text-sm text-[var(--muted)]">Check your connection and try again. If you were submitting a payment or entry, check its status before submitting it again.</p>
        <button onClick={retry} className="mt-6 w-full rounded-xl bg-[var(--teal)] p-3 font-bold text-white">Try again</button>
        <p className="mt-4 text-xs text-[var(--muted)]">Keep this browser’s saved data if you have driver submissions waiting to sync.</p>
      </section>
    </main>
  );
}
