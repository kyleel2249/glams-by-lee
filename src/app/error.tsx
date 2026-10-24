'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-ink px-6 text-center text-ivory">
      <div>
        <h1 className="text-4xl">Something went wrong</h1>
        <p className="mt-3 text-ivory/75">We could not load this page. Please try again in a moment.</p>
        <button onClick={reset} className="btn-gold mt-8">Try again</button>
      </div>
    </main>
  );
}
