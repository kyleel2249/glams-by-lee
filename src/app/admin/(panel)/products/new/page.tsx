import { requirePermission } from '@/lib/admin/auth';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, Flash, PageTitle } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/ProductForm';
import { createProduct } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePermission('products.write');
  const { data } = await createAdmin().from('categories').select('id, name').order('sort_order');
  return (<><PageTitle title="Add product" /><Flash error={(await searchParams).error} /><Card><ProductForm action={createProduct} categories={(data ?? []) as { id: string; name: string }[]} submitLabel="Create product" allowPublish={false} /></Card></>);
}
