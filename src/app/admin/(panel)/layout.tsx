import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStaff } from '@/lib/admin/auth';
import { can, ROLE_LABEL, type Permission } from '@/lib/admin/permissions';
import { Wordmark } from '@/components/brand/Wordmark';
import { logoutAction } from '../login/actions';

const NAV: { href: string; label: string; perm: Permission }[] = [
  { href: '/admin', label: 'Dashboard', perm: 'dashboard.view' }, { href: '/admin/orders', label: 'Orders', perm: 'orders.view' },
  { href: '/admin/products', label: 'Products', perm: 'products.write' }, { href: '/admin/categories', label: 'Categories', perm: 'categories.write' },
  { href: '/admin/inventory', label: 'Inventory', perm: 'inventory.view' }, { href: '/admin/reviews', label: 'Reviews', perm: 'reviews.moderate' }, { href: '/admin/discounts', label: 'Discounts', perm: 'discounts.write' },
  { href: '/admin/shipping', label: 'Shipping', perm: 'shipping.write' }, { href: '/admin/content', label: 'Content', perm: 'content.write' },
  { href: '/admin/settings', label: 'Settings', perm: 'settings.write' }, { href: '/admin/privacy', label: 'Privacy requests', perm: 'privacy.manage' }, { href: '/admin/team', label: 'Team', perm: 'roles.manage' }, { href: '/admin/audit', label: 'Audit log', perm: 'audit.view' },
];

export default async function Panel({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  if (staff.roles.length === 0) redirect('/admin/forbidden');
  return (
    <div className="md:grid md:grid-cols-[14rem_1fr]">
      <aside className="bg-ink text-ivory md:min-h-screen">
        <div className="flex items-center justify-between px-4 py-4 md:block"><Link href="/admin" aria-label="Admin home"><Wordmark tone="gold" variant="compact" className="h-7 w-auto" /></Link></div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-3 md:block md:space-y-1 md:pb-0">
          {NAV.filter((n) => can(staff.roles, n.perm)).map((n) => <Link key={n.href} href={n.href} className="block whitespace-nowrap px-3 py-2.5 text-sm hover:bg-charcoal">{n.label}</Link>)}
        </nav>
        <div className="hidden border-t border-ivory/15 p-4 text-xs md:block">
          <p className="truncate">{staff.email}</p><p className="mt-1 text-ivory/60">{staff.roles.map((r) => ROLE_LABEL[r]).join(', ')}</p>
          <form action={logoutAction}><button className="mt-3 underline">Sign out</button></form>
          <Link href="/" className="mt-3 block underline">View shop</Link>
        </div>
      </aside>
      <div className="min-w-0 p-4 md:p-8">{children}<form action={logoutAction} className="mt-10 md:hidden"><button className="text-sm underline">Sign out ({staff.email})</button></form></div>
    </div>
  );
}
