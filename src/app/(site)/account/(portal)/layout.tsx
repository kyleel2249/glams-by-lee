import { headers } from 'next/headers';
import Link from 'next/link';
import { safeNext } from '@/lib/customer/next';
import { requireCustomer } from '@/lib/customer/auth';
import { logoutAction } from '../actions';

const NAV = [['/account', 'Overview'], ['/account/orders', 'Orders'], ['/account/wishlist', 'Wishlist'], ['/account/addresses', 'Addresses'], ['/account/profile', 'Profile']] as const;

export const metadata = { robots: { index: false, follow: false } };

export default async function Portal({ children }: { children: React.ReactNode }) {
  const customer = await requireCustomer(safeNext((await headers()).get('x-pathname')));
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:grid md:grid-cols-[13rem_1fr] md:gap-10">
      <aside className="mb-8 md:mb-0">
        <p className="truncate text-sm text-muted">{customer.email}</p>
        <nav aria-label="Account" className="mt-3 flex gap-1 overflow-x-auto md:block md:space-y-1">
          {NAV.map(([href, label]) => <Link key={href} href={href} className="block whitespace-nowrap border border-line bg-white px-4 py-2.5 text-sm hover:border-ink md:border-0 md:bg-transparent md:px-0 md:py-2 md:hover:underline">{label}</Link>)}
        </nav>
        <form action={logoutAction} className="mt-4"><button className="text-sm underline">Sign out</button></form>
      </aside>
      <div className="min-w-0">{children}</div>
    </main>
  );
}
