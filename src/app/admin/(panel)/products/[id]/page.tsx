import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/lib/admin/auth';
import { can } from '@/lib/admin/permissions';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, Check, Field, Flash, PageTitle } from '@/components/admin/ui';
import { ProductForm, type ProductDefaults } from '@/components/admin/ProductForm';
import { deleteImage, deleteProduct, deleteVariant, saveVariant, updateImage, updateProduct, uploadImage } from '../actions';

export const dynamic = 'force-dynamic';
interface V { id: string; sku: string; length_inches: number | null; color: string | null; density: string | null; cap_size: string | null; price_minor: number; compare_at_price_minor: number | null; weight_grams: number | null; low_stock_threshold: number; allow_backorder: boolean; is_active: boolean }

function VariantForm({ productId, v, canEdit }: { productId: string; v?: V; canEdit: boolean }) {
  const d = (x: unknown) => (x === null || x === undefined ? '' : String(x));
  return (
    <form action={saveVariant} className="grid gap-3 border border-line p-4">
      <input type="hidden" name="productId" value={productId} />{v ? <input type="hidden" name="variantId" value={v.id} /> : null}
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-3">
        <Field label="Variant SKU"><input name="sku" required defaultValue={d(v?.sku)} className="field font-normal" /></Field>
        <Field label="Length (inches)"><input name="lengthInches" type="number" min="1" max="80" defaultValue={d(v?.length_inches)} className="field font-normal" /></Field>
        <Field label="Colour"><input name="color" defaultValue={d(v?.color)} className="field font-normal" /></Field>
        <Field label="Density"><input name="density" defaultValue={d(v?.density)} placeholder="e.g. 180%" className="field font-normal" /></Field>
        <Field label="Cap size"><input name="capSize" defaultValue={d(v?.cap_size)} className="field font-normal" /></Field>
        <Field label="Weight (grams)" hint="Used for weight-based shipping"><input name="weightGrams" type="number" min="0" defaultValue={d(v?.weight_grams)} className="field font-normal" /></Field>
        <Field label="Price (GH₵)"><input name="price" required inputMode="decimal" defaultValue={v ? (Number(v.price_minor) / 100).toFixed(2) : ''} className="field font-normal" /></Field>
        <Field label="Previous price (GH₵)" hint="Only set for a genuine sale"><input name="compareAt" inputMode="decimal" defaultValue={v?.compare_at_price_minor ? (Number(v.compare_at_price_minor) / 100).toFixed(2) : ''} className="field font-normal" /></Field>
        <Field label="Low-stock alert at"><input name="lowStockThreshold" type="number" min="0" defaultValue={v?.low_stock_threshold ?? 2} className="field font-normal" /></Field>
        <Check name="isActive" label="Available to buy" defaultChecked={v ? v.is_active : true} />
        <Check name="allowBackorder" label="Allow orders when out of stock" defaultChecked={v?.allow_backorder} />
      </fieldset>
      {canEdit ? <div className="flex gap-3"><button className="btn-gold !min-h-[40px]">{v ? 'Save variant' : 'Add variant'}</button>
        {v ? <button formAction={deleteVariant} className="btn-outline !min-h-[40px]">Delete</button> : null}</div> : null}
    </form>
  );
}

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const staff = await requirePermission('products.write');
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = createAdmin();
  const [{ data: p }, { data: cats }, { data: vars }, { data: imgs }] = await Promise.all([
    db.from('products').select('*').eq('id', id).maybeSingle(), db.from('categories').select('id, name').order('sort_order'),
    db.from('product_variants').select('*').eq('product_id', id).order('sort_order').order('created_at'),
    db.from('product_images').select('id, url, alt_text, sort_order').eq('product_id', id).order('sort_order'),
  ]);
  if (!p) notFound();
  const product = p as ProductDefaults & { name: string }; const variants = (vars ?? []) as V[];
  const images = (imgs ?? []) as { id: string; url: string; alt_text: string; sort_order: number }[];
  const canVariants = can(staff.roles, 'variants.write');
  return (
    <>
      <Link href="/admin/products" className="text-sm underline">← All products</Link>
      <PageTitle title={product.name}><span className="badge text-sm">{product.is_published ? 'Published' : 'Draft'}</span></PageTitle>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6">
        <Card title="Details"><ProductForm action={updateProduct} defaults={{ ...product, id }} categories={(cats ?? []) as { id: string; name: string }[]} submitLabel="Save product" allowPublish /></Card>
        <Card title="Variants and prices">
          <p className="mb-4 text-sm text-muted">Each combination a customer can buy (for example 18 inches in Natural black). Stock is managed on the Inventory page.{!canVariants ? ' Your role can view variants but not change prices.' : ''}</p>
          <div className="grid gap-4">{variants.map((v) => <VariantForm key={v.id} productId={id} v={v} canEdit={canVariants} />)}</div>
          {canVariants ? <details className="mt-4" open={variants.length === 0}><summary className="cursor-pointer text-sm font-medium underline">Add a variant</summary><div className="mt-3"><VariantForm productId={id} canEdit /></div></details> : null}
        </Card>
        <Card title="Photos">
          {images.length ? <ul className="mb-5 grid gap-4 sm:grid-cols-2">{images.map((i) => (
            <li key={i.id} className="grid grid-cols-[6rem_1fr] gap-3 border border-line p-3">
              <div className="relative aspect-[4/5] bg-line"><Image src={i.url} alt={i.alt_text} fill sizes="96px" className="object-cover" /></div>
              <form action={updateImage} className="grid gap-2"><input type="hidden" name="productId" value={id} /><input type="hidden" name="imageId" value={i.id} />
                <label className="grid gap-1 text-xs font-medium">Alt text<input name="alt" required defaultValue={i.alt_text} className="field !min-h-[36px] font-normal" /></label>
                <label className="grid gap-1 text-xs font-medium">Position (0 = main photo)<input name="sortOrder" type="number" min="0" defaultValue={i.sort_order} className="field !min-h-[36px] font-normal" /></label>
                <div className="flex gap-2"><button className="btn-outline !min-h-[36px] !px-4">Save</button><button formAction={deleteImage} className="btn-outline !min-h-[36px] !px-4">Remove</button></div></form>
            </li>))}</ul> : <p className="mb-4 text-sm text-muted">No photos yet. Shoppers buy what they can see, so add at least one.</p>}
          <form action={uploadImage} className="grid max-w-md gap-3"><input type="hidden" name="productId" value={id} />
            <Field label="Photo (JPG, PNG, WebP or AVIF, up to 5 MB)"><input type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="field py-2 font-normal" /></Field>
            <Field label="Describe the photo" hint="For screen readers and search, e.g. Model wearing an 18 inch body wave lace front wig"><input name="alt" required minLength={3} maxLength={200} className="field font-normal" /></Field>
            <button className="btn-outline justify-self-start">Upload photo</button></form>
        </Card>
        <Card title="Delete product">
          <p className="mb-3 text-sm text-muted">Products that have been ordered cannot be deleted; unpublish them instead.</p>
          <form action={deleteProduct}><input type="hidden" name="id" value={id} /><button className="btn-outline">Delete this product</button></form>
        </Card>
      </div>
    </>
  );
}
