'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, dbMessage, parseForm } from '@/lib/admin/action';
import { recordAudit } from '@/lib/admin/audit';
import { requirePermission } from '@/lib/admin/auth';
import { productSchema, variantSchema } from '@/lib/admin/schemas';
import { createAdmin } from '@/lib/supabase/admin';

const uuid = z.string().uuid();
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX_IMAGE = 5 * 1024 * 1024;
const refresh = (id?: string) => { revalidatePath('/admin/products'); if (id) revalidatePath(`/admin/products/${id}`); revalidatePath('/shop'); revalidatePath('/'); };
const toRow = (d: ReturnType<typeof productSchema.parse>) => ({
  name: d.name, slug: d.slug, sku: d.sku, description: d.description ?? null, product_type: d.productType, category_id: d.categoryId ?? null, hair_material: d.hairMaterial ?? null,
  texture: d.texture ?? null, construction: d.construction ?? null, lace_type: d.laceType ?? null, care_instructions: d.careInstructions ?? null,
  shipping_returns_note: d.shippingReturnsNote ?? null, is_featured: d.isFeatured, is_published: d.isPublished,
});

/** Publishing needs at least one active, priced variant. A product nobody can buy should not be on the shop floor. */
async function canPublish(productId: string): Promise<boolean> {
  const { count } = await createAdmin().from('product_variants').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('is_active', true);
  return (count ?? 0) > 0;
}

export async function createProduct(fd: FormData) {
  const staff = await requirePermission('products.write');
  const p = parseForm(productSchema, fd);
  if (!p.ok) back('/admin/products/new', 'error', p.error);
  if (p.data.isPublished) back('/admin/products/new', 'error', 'Save the product first, add a variant, then publish it.');
  const { data, error } = await createAdmin().from('products').insert(toRow(p.data)).select('id').single();
  if (error || !data) back('/admin/products/new', 'error', dbMessage(error ?? {}));
  const id = (data as { id: string }).id;
  await recordAudit(staff.userId, 'product.created', 'product', id, { sku: p.data.sku });
  refresh();
  back(`/admin/products/${id}`, 'ok', 'Product created. Now add at least one variant (size, colour and price) and a photo.');
}

export async function updateProduct(fd: FormData) {
  const staff = await requirePermission('products.write');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) back('/admin/products', 'error', 'Product not found.');
  const path = `/admin/products/${id.data}`;
  const p = parseForm(productSchema, fd);
  if (!p.ok) back(path, 'error', p.error);
  if (p.data.isPublished && !(await canPublish(id.data))) back(path, 'error', 'Add at least one active variant with a price before publishing.');
  const { error } = await createAdmin().from('products').update(toRow(p.data)).eq('id', id.data);
  if (error) back(path, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'product.updated', 'product', id.data, { published: p.data.isPublished, featured: p.data.isFeatured });
  refresh(id.data);
  back(path, 'ok', 'Product saved.');
}

export async function deleteProduct(fd: FormData) {
  const staff = await requirePermission('products.write');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) back('/admin/products', 'error', 'Product not found.');
  const db = createAdmin();
  const { count } = await db.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id.data);
  if ((count ?? 0) > 0) back(`/admin/products/${id.data}`, 'error', 'This product has been ordered, so it cannot be deleted. Unpublish it instead; past orders keep their details.');
  const { error } = await db.from('products').delete().eq('id', id.data);
  if (error) back(`/admin/products/${id.data}`, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'product.deleted', 'product', id.data);
  refresh();
  back('/admin/products', 'ok', 'Product deleted.');
}

const variantRow = (d: ReturnType<typeof variantSchema.parse>) => ({
  sku: d.sku, length_inches: d.lengthInches ?? null, color: d.color ?? null, density: d.density ?? null, cap_size: d.capSize ?? null, price_minor: d.price,
  compare_at_price_minor: d.compareAt ?? null, weight_grams: d.weightGrams ?? null, low_stock_threshold: d.lowStockThreshold, allow_backorder: d.allowBackorder, is_active: d.isActive,
});

export async function saveVariant(fd: FormData) {
  const staff = await requirePermission('variants.write');
  const productId = uuid.safeParse(fd.get('productId')), variantId = uuid.safeParse(fd.get('variantId') || undefined);
  if (!productId.success) back('/admin/products', 'error', 'Product not found.');
  const path = `/admin/products/${productId.data}`;
  const p = parseForm(variantSchema, fd);
  if (!p.ok) back(path, 'error', p.error);
  const db = createAdmin();
  const res = variantId.success
    ? await db.from('product_variants').update(variantRow(p.data)).eq('id', variantId.data).eq('product_id', productId.data).select('id').single()
    : await db.from('product_variants').insert({ ...variantRow(p.data), product_id: productId.data }).select('id').single();
  if (res.error || !res.data) back(path, 'error', dbMessage(res.error ?? {}));
  await recordAudit(staff.userId, variantId.success ? 'variant.updated' : 'variant.created', 'product', productId.data, { sku: p.data.sku, price_minor: p.data.price });
  refresh(productId.data);
  back(path, 'ok', variantId.success ? 'Variant saved.' : 'Variant added. Set its stock on the Inventory page.');
}

export async function deleteVariant(fd: FormData) {
  const staff = await requirePermission('variants.write');
  const productId = uuid.safeParse(fd.get('productId')), variantId = uuid.safeParse(fd.get('variantId'));
  if (!productId.success || !variantId.success) back('/admin/products', 'error', 'Variant not found.');
  const path = `/admin/products/${productId.data}`;
  const db = createAdmin();
  const { count } = await db.from('order_items').select('id', { count: 'exact', head: true }).eq('variant_id', variantId.data);
  if ((count ?? 0) > 0) back(path, 'error', 'This variant has been ordered. Turn off "Available to buy" instead of deleting it.');
  const { error } = await db.from('product_variants').delete().eq('id', variantId.data).eq('product_id', productId.data);
  if (error) back(path, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'variant.deleted', 'product', productId.data, { variantId: variantId.data });
  refresh(productId.data);
  back(path, 'ok', 'Variant deleted.');
}

export async function uploadImage(fd: FormData) {
  const staff = await requirePermission('products.write');
  const productId = uuid.safeParse(fd.get('productId'));
  if (!productId.success) back('/admin/products', 'error', 'Product not found.');
  const path = `/admin/products/${productId.data}`;
  const file = fd.get('file'), alt = z.string().trim().min(3, 'Describe the photo for screen readers (alt text)').max(200).safeParse(fd.get('alt'));
  if (!alt.success) back(path, 'error', alt.error.issues[0].message);
  if (!(file instanceof File) || file.size === 0) back(path, 'error', 'Choose a photo to upload.');
  const ext = IMAGE_TYPES[(file as File).type];
  if (!ext) back(path, 'error', 'Photos must be JPG, PNG, WebP or AVIF.');
  if ((file as File).size > MAX_IMAGE) back(path, 'error', 'That photo is over 5 MB. Please resize it first.');
  const db = createAdmin();
  // Extension comes from the validated MIME type, never from the uploaded file name.
  const objectPath = `${productId.data}/${crypto.randomUUID()}.${ext}`;
  const up = await db.storage.from('product-images').upload(objectPath, file as File, { contentType: (file as File).type, upsert: false });
  if (up.error) { console.error('image upload failed', up.error.message); back(path, 'error', 'Upload failed. Check that the product-images storage bucket exists.'); }
  const { data: pub } = db.storage.from('product-images').getPublicUrl(objectPath);
  const { count } = await db.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId.data);
  const { error } = await db.from('product_images').insert({ product_id: productId.data, url: pub.publicUrl, alt_text: alt.data, sort_order: count ?? 0 });
  if (error) { await db.storage.from('product-images').remove([objectPath]); back(path, 'error', dbMessage(error)); }
  await recordAudit(staff.userId, 'product.image_added', 'product', productId.data);
  refresh(productId.data);
  back(path, 'ok', 'Photo added.');
}

export async function updateImage(fd: FormData) {
  await requirePermission('products.write');
  const productId = uuid.safeParse(fd.get('productId')), imageId = uuid.safeParse(fd.get('imageId'));
  if (!productId.success || !imageId.success) back('/admin/products', 'error', 'Photo not found.');
  const path = `/admin/products/${productId.data}`;
  const alt = z.string().trim().min(3).max(200).safeParse(fd.get('alt')), order = z.coerce.number().int().min(0).max(999).safeParse(fd.get('sortOrder'));
  if (!alt.success || !order.success) back(path, 'error', 'Alt text (3+ characters) and a position number are required.');
  const { error } = await createAdmin().from('product_images').update({ alt_text: alt.data, sort_order: order.data }).eq('id', imageId.data).eq('product_id', productId.data);
  if (error) back(path, 'error', dbMessage(error));
  refresh(productId.data);
  back(path, 'ok', 'Photo saved.');
}

export async function deleteImage(fd: FormData) {
  const staff = await requirePermission('products.write');
  const productId = uuid.safeParse(fd.get('productId')), imageId = uuid.safeParse(fd.get('imageId'));
  if (!productId.success || !imageId.success) back('/admin/products', 'error', 'Photo not found.');
  const path = `/admin/products/${productId.data}`;
  const db = createAdmin();
  const { data } = await db.from('product_images').select('url').eq('id', imageId.data).eq('product_id', productId.data).maybeSingle();
  const { error } = await db.from('product_images').delete().eq('id', imageId.data).eq('product_id', productId.data);
  if (error) back(path, 'error', dbMessage(error));
  const url = (data as { url: string } | null)?.url, marker = '/product-images/';
  if (url && url.includes(marker)) await db.storage.from('product-images').remove([url.split(marker)[1]]).catch(() => {});
  await recordAudit(staff.userId, 'product.image_removed', 'product', productId.data);
  refresh(productId.data);
  back(path, 'ok', 'Photo removed.');
}
