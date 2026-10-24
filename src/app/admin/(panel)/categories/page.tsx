import { requirePermission } from '@/lib/admin/auth';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, Check, Field, Flash, PageTitle } from '@/components/admin/ui';
import { deleteCategory, saveCategory } from './actions';

export const dynamic = 'force-dynamic';
interface C { id: string; name: string; slug: string; description: string | null; parent_id: string | null; sort_order: number; is_visible: boolean }

function CategoryForm({ c, all }: { c?: C; all: C[] }) {
  return (
    <form action={saveCategory} className="grid gap-3 sm:grid-cols-2">
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <Field label="Name"><input name="name" required defaultValue={c?.name} className="field font-normal" /></Field>
      <Field label="Web address ending"><input name="slug" defaultValue={c?.slug} className="field font-normal" /></Field>
      <Field label="Parent category"><select name="parentId" defaultValue={c?.parent_id ?? ''} className="field font-normal"><option value="">None (top level)</option>{all.filter((x) => x.id !== c?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Order (lowest first)"><input name="sortOrder" type="number" min="0" defaultValue={c?.sort_order ?? 0} className="field font-normal" /></Field>
      <div className="sm:col-span-2"><Field label="Short description"><input name="description" maxLength={500} defaultValue={c?.description ?? ''} className="field font-normal" /></Field></div>
      <Check name="isVisible" label="Visible in the shop" defaultChecked={c ? c.is_visible : true} />
      <div className="flex gap-3 sm:col-span-2"><button className="btn-gold !min-h-[40px]">{c ? 'Save' : 'Add category'}</button>{c ? <button formAction={deleteCategory} className="btn-outline !min-h-[40px]">Delete</button> : null}</div>
    </form>
  );
}

export default async function Categories({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission('categories.write');
  const sp = await searchParams;
  const { data } = await createAdmin().from('categories').select('id, name, slug, description, parent_id, sort_order, is_visible').order('sort_order');
  const cats = (data ?? []) as C[];
  return (
    <>
      <PageTitle title="Categories" /><Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6">
        <Card title="Add a category"><CategoryForm all={cats} /></Card>
        {cats.map((c) => <Card key={c.id} title={c.name}><CategoryForm c={c} all={cats} /></Card>)}
      </div>
    </>
  );
}
