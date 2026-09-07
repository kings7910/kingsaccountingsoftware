import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-6">
      <section className="card w-full max-w-md p-8">
        <p className="text-sm font-bold text-[var(--teal)]">King’s Accounting · 404</p>
        <h1 className="display mt-3 text-2xl font-extrabold">Page not found</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">This address doesn’t lead to a page. Open your workspace to continue.</p>
        <Link href="/workspace" className="mt-6 block rounded-xl bg-[var(--teal)] p-3 text-center font-bold text-white">Open workspace</Link>
        <Link href="/" className="mt-4 block text-center text-sm font-bold text-[var(--teal)]">View demo</Link>
      </section>
    </main>
  );
}
