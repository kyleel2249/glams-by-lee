import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { safeQuery } from '@/lib/admin/query';
import { formatMoney } from '@/lib/money';
import { createAdmin } from '@/lib/supabase/admin';
import { Flash, PageTitle, Table } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  await requirePermission('products.write');
  const sp = await searchParams, q = safeQuery(sp.q);
  let query = createAdmin().from('products').select('id, name, sku, is_published, is_featured, product_variants(price_minor, is_active), categories(name)').order('created_at', { ascending: false }).limit(200);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) throw new Error('Products query failed');
  const rows = (data ?? []) as unknown as { id: string; name: string; sku: string; is_published: boolean; is_featured: boolean; product_variants: { price_minor: number; is_active: boolean }[]; categories: { name: string } | null }[];
  return (
    <>
      <PageTitle title="Products"><Link href="/admin/products/new" className="btn-gold">Add product</Link></PageTitle>
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 flex max-w-md gap-2" role="search"><label className="sr-only" htmlFor="pq">Search products</label><input id="pq" name="q" defaultValue={q} placeholder="Name or SKU" className="field" /><button className="btn-outline">Search</button></form>
      {rows.length ? (
        <Table head={['Product', 'SKU', 'Category', 'Variants', 'Price', 'Status']}>
          {rows.map((p) => { const active = p.product_variants.filter((v) => v.is_active); const prices = active.map((v) => Number(v.price_minor));
            return (<tr key={p.id} className="hover:bg-ivory">
              <td className="px-3 py-2"><Link href={`/admin/products/${p.id}`} className="font-medium underline">{p.name}</Link>{p.is_featured ? <span className="badge ml-2">Featured</span> : null}</td>
              <td className="px-3 py-2">{p.sku}</td><td className="px-3 py-2">{p.categories?.name ?? '—'}</td><td className="px-3 py-2">{active.length}</td>
              <td className="px-3 py-2 whitespace-nowrap">{prices.length ? (Math.min(...prices) === Math.max(...prices) ? formatMoney(prices[0]) : `${formatMoney(Math.min(...prices))} – ${formatMoney(Math.max(...prices))}`) : '—'}</td>
              <td className="px-3 py-2">{p.is_published ? 'Published' : 'Draft'}</td></tr>); })}
        </Table>
      ) : <p className="border border-line bg-white p-6 text-center text-muted">No products yet. Add your first product to start selling.</p>}
    </>
  );
}
