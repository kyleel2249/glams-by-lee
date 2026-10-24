import { PRODUCT_TYPES } from '@/lib/admin/schemas';
import { Check, Field } from './ui';

export interface ProductDefaults { id?: string; name?: string; slug?: string; sku?: string; description?: string | null; product_type?: string; category_id?: string | null; hair_material?: string | null; texture?: string | null; construction?: string | null; lace_type?: string | null; care_instructions?: string | null; shipping_returns_note?: string | null; is_featured?: boolean; is_published?: boolean }
const TYPE_LABEL: Record<string, string> = { wig: 'Wig', bundle: 'Hair bundle', closure_frontal: 'Closure or frontal', wig_cap: 'Wig cap', hair_care: 'Hair care', accessory: 'Accessory' };

export function ProductForm({ action, defaults = {}, categories, submitLabel, allowPublish }: { action: (fd: FormData) => Promise<void>; defaults?: ProductDefaults; categories: { id: string; name: string }[]; submitLabel: string; allowPublish: boolean }) {
  const t = (v?: string | null) => v ?? '';
  return (
    <form action={action} className="grid gap-4">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Product name"><input name="name" required maxLength={160} defaultValue={t(defaults.name)} className="field font-normal" /></Field>
        <Field label="SKU" hint="Unique code, e.g. BW-LF-001"><input name="sku" required maxLength={60} defaultValue={t(defaults.sku)} className="field font-normal" /></Field>
        <Field label="Web address ending" hint="Leave blank to build it from the name"><input name="slug" maxLength={80} defaultValue={t(defaults.slug)} className="field font-normal" /></Field>
        <Field label="Type"><select name="productType" defaultValue={defaults.product_type ?? 'wig'} className="field font-normal">{PRODUCT_TYPES.map((p) => <option key={p} value={p}>{TYPE_LABEL[p]}</option>)}</select></Field>
        <Field label="Category"><select name="categoryId" defaultValue={defaults.category_id ?? ''} className="field font-normal"><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Hair material" hint="Only what you can stand behind, e.g. Human hair"><input name="hairMaterial" maxLength={80} defaultValue={t(defaults.hair_material)} className="field font-normal" /></Field>
        <Field label="Texture" hint="e.g. Body wave, Deep wave, Straight"><input name="texture" maxLength={80} defaultValue={t(defaults.texture)} className="field font-normal" /></Field>
        <Field label="Construction" hint="e.g. Lace front, Glueless, Closure"><input name="construction" maxLength={80} defaultValue={t(defaults.construction)} className="field font-normal" /></Field>
        <Field label="Lace type"><input name="laceType" maxLength={80} defaultValue={t(defaults.lace_type)} className="field font-normal" /></Field>
      </div>
      <Field label="Description"><textarea name="description" rows={5} maxLength={5000} defaultValue={t(defaults.description)} className="field py-2 font-normal" /></Field>
      <Field label="Care instructions"><textarea name="careInstructions" rows={3} maxLength={3000} defaultValue={t(defaults.care_instructions)} className="field py-2 font-normal" /></Field>
      <Field label="Shipping and returns note (optional)" hint="Shown on the product page instead of the default policy links"><textarea name="shippingReturnsNote" rows={2} maxLength={1000} defaultValue={t(defaults.shipping_returns_note)} className="field py-2 font-normal" /></Field>
      <div className="flex flex-wrap gap-6">
        <Check name="isFeatured" label="Feature on the homepage (best sellers)" defaultChecked={defaults.is_featured} />
        {allowPublish ? <Check name="isPublished" label="Published (visible in the shop)" defaultChecked={defaults.is_published} /> : <p className="text-sm text-muted">You can publish after adding a variant.</p>}
      </div>
      <button className="btn-gold justify-self-start">{submitLabel}</button>
    </form>
  );
}
