import { requireCustomer } from '@/lib/customer/auth';
import { getDeliveryCountries } from '@/lib/catalog';
import { createServer } from '@/lib/supabase/server';
import { deleteAddress, saveAddress } from './actions';

export const dynamic = 'force-dynamic';
interface A { id: string; label: string | null; recipient_name: string; phone: string; line1: string; line2: string | null; city: string; region: string | null; postal_code: string | null; country_code: string; is_default: boolean }

function AddressForm({ a, countries }: { a?: A; countries: { code: string; name: string }[] }) {
  const f = 'field font-normal';
  return (
    <form action={saveAddress} className="grid gap-3 sm:grid-cols-2">{a ? <input type="hidden" name="id" value={a.id} /> : null}
      <label className="grid gap-1 text-sm font-medium">Label (optional)<input name="label" defaultValue={a?.label ?? ''} placeholder="Home, Work" className={f} /></label>
      <label className="grid gap-1 text-sm font-medium">Recipient name<input name="recipientName" required defaultValue={a?.recipient_name} autoComplete="name" className={f} /></label>
      <label className="grid gap-1 text-sm font-medium">Phone<input name="phone" required defaultValue={a?.phone} autoComplete="tel" className={f} /></label>
      <label className="grid gap-1 text-sm font-medium">Country<select name="country" defaultValue={a?.country_code ?? 'GH'} className={f}>{countries.length ? countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>) : <option value="GH">Ghana</option>}</select></label>
      <label className="grid gap-1 text-sm font-medium sm:col-span-2">Address<input name="line1" required defaultValue={a?.line1} autoComplete="address-line1" className={f} /></label>
      <label className="grid gap-1 text-sm font-medium sm:col-span-2">Apartment, landmark or directions<input name="line2" defaultValue={a?.line2 ?? ''} className={f} /></label>
      <label className="grid gap-1 text-sm font-medium">City or town<input name="city" required defaultValue={a?.city} className={f} /></label>
      <label className="grid gap-1 text-sm font-medium">Region<input name="region" defaultValue={a?.region ?? ''} className={f} /></label>
      <label className="grid gap-1 text-sm font-medium">Postal code<input name="postalCode" defaultValue={a?.postal_code ?? ''} className={f} /></label>
      <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" name="isDefault" defaultChecked={a?.is_default} className="h-5 w-5 accent-gold-deep" />Use as my default address</label>
      <div className="flex gap-3 sm:col-span-2"><button className="btn-gold !min-h-[40px]">{a ? 'Save address' : 'Add address'}</button>{a ? <button formAction={deleteAddress} className="btn-outline !min-h-[40px]">Delete</button> : null}</div>
    </form>
  );
}

export default async function Addresses({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const c = await requireCustomer('/account/addresses');
  const sp = await searchParams;
  const [{ data }, countries] = await Promise.all([(await createServer()).from('addresses').select('*').eq('user_id', c.id).order('created_at'), getDeliveryCountries()]);
  const list = (data ?? []) as A[];
  return (
    <>
      <h1 className="text-4xl">Saved addresses</h1>
      {sp.error ? <p role="alert" className="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{sp.error}</p> : null}
      {sp.ok ? <p role="status" className="mt-4 border border-gold bg-white p-3 text-sm text-gold-deep">{sp.ok}</p> : null}
      <div className="mt-6 grid gap-6">
        {list.map((a) => <section key={a.id} className="border border-line bg-white p-5"><h2 className="mb-3 font-display text-2xl">{a.label || a.recipient_name}{a.is_default ? <span className="badge ml-3 align-middle">Default</span> : null}</h2><AddressForm a={a} countries={countries} /></section>)}
        <section className="border border-line bg-white p-5"><h2 className="mb-3 font-display text-2xl">Add an address</h2><AddressForm countries={countries} /></section>
      </div>
    </>
  );
}
