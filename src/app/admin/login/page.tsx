import { Wordmark } from '@/components/brand/Wordmark';
import { loginAction } from './actions';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-ink px-4">
      <form action={loginAction} className="w-full max-w-sm bg-ivory p-8">
        <Wordmark tone="dark" className="mx-auto h-16 w-auto" />
        <h1 className="mt-6 text-center text-3xl">Staff sign in</h1>
        {error ? <p role="alert" className="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        <label className="mt-6 grid gap-1 text-sm font-medium">Email<input name="email" type="email" required autoComplete="username" className="field font-normal" /></label>
        <label className="mt-4 grid gap-1 text-sm font-medium">Password<input name="password" type="password" required autoComplete="current-password" className="field font-normal" /></label>
        <button className="btn-gold mt-6 w-full">Sign in</button>
      </form>
    </main>
  );
}
