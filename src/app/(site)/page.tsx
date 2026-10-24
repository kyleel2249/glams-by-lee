import Image from 'next/image';
import Link from 'next/link';
import { NewsletterForm } from '@/components/shop/NewsletterForm';
import { ProductGrid } from '@/components/shop/ProductCard';
import { BRAND } from '@/lib/brand';
import { getCategories, getProducts, getSettings, getShippingZoneNames, getSiteContent } from '@/lib/catalog';
import { whatsAppLink } from '@/lib/whatsapp';

export const revalidate = 300;

interface Hero { headline?: string; subtext?: string; image_url?: string | null; primary_cta?: { label: string; href: string }; secondary_cta?: { label: string; href: string } }
interface Care { title?: string; body?: string; href?: string }

export default async function Home() {
  const [hero, care, categories, products, settings, zones] = await Promise.all([
    getSiteContent<Hero>('hero'), getSiteContent<Care>('care_guide'), getCategories(), getProducts(), getSettings(), getShippingZoneNames(),
  ]);
  const topCategories = categories.filter((c) => !c.parentId);
  const featured = products.filter((p) => p.isFeatured).slice(0, 8);
  const newest = products.slice(0, 8);
  const wa = whatsAppLink(settings.whatsappNumber, 'Hello GLAMS BY LEE, I have a question.');
  const benefits = [
    zones.length ? { title: 'Delivery', text: `We deliver to: ${zones.join(', ')}.` } : null,
    wa ? { title: 'Personal support', text: `Message us on WhatsApp.${settings.supportHours ? ` ${settings.supportHours}` : ''}` } : null,
    { title: 'Find your fit', text: 'Answer a few questions and we will point you to wigs that match your preferences.' },
  ].filter((b): b is { title: string; text: string } => b !== null);

  return (
    <main>
      {/* Hero: image comes from the admin-managed 'hero' content; typographic until real photography is supplied */}
      <section className="relative isolate overflow-hidden bg-ink text-ivory">
        {hero?.image_url ? <Image src={hero.image_url} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-60" /> : null}
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-32">
          <h1 className="max-w-3xl text-5xl md:text-7xl">{hero?.headline ?? BRAND.tagline}</h1>
          <p className="mt-6 max-w-xl text-lg text-ivory/85">{hero?.subtext ?? 'Discover wigs, bundles and hair essentials curated to help you express your signature look.'}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={hero?.primary_cta?.href ?? '/shop'} className="btn-gold">{hero?.primary_cta?.label ?? 'Shop Wigs'}</Link>
            <Link href={hero?.secondary_cta?.href ?? '/find-your-wig'} className="btn-outline-light">{hero?.secondary_cta?.label ?? 'Find Your Style'}</Link>
          </div>
        </div>
      </section>

      {topCategories.length ? (
        <section className="mx-auto max-w-7xl px-4 py-16" aria-labelledby="cats">
          <h2 id="cats" className="text-3xl md:text-4xl">Shop by category</h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {topCategories.map((c) => (
              <li key={c.id}>
                <Link href={`/shop/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden bg-charcoal">
                  {c.imageUrl ? <Image src={c.imageUrl} alt="" fill sizes="(min-width:768px) 25vw, 50vw" className="object-cover opacity-80 transition-transform duration-500 group-hover:scale-[1.04]" /> : null}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-4 font-display text-xl text-ivory">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {featured.length ? (
        <section className="mx-auto max-w-7xl px-4 py-12" aria-labelledby="best">
          <div className="flex items-end justify-between"><h2 id="best" className="text-3xl md:text-4xl">Best sellers</h2><Link href="/shop?sort=featured" className="text-sm underline">View all</Link></div>
          <div className="mt-8"><ProductGrid products={featured} /></div>
        </section>
      ) : null}

      {newest.length ? (
        <section className="mx-auto max-w-7xl px-4 py-12" aria-labelledby="new">
          <div className="flex items-end justify-between"><h2 id="new" className="text-3xl md:text-4xl">New arrivals</h2><Link href="/shop?sort=newest" className="text-sm underline">View all</Link></div>
          <div className="mt-8"><ProductGrid products={newest} /></div>
        </section>
      ) : null}

      <section className="bg-charcoal py-16 text-ivory" aria-labelledby="quiz">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 md:grid-cols-2">
          <h2 id="quiz" className="text-4xl md:text-5xl">Find your perfect wig</h2>
          <div><p className="text-ivory/85">Tell us the texture, length and budget you have in mind and we will show the wigs that match. Skip anything you are unsure about.</p><Link href="/find-your-wig" className="btn-gold mt-6">Start the Wig Finder</Link></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16" aria-label="Shopping with GLAMS BY LEE">
        <ul className="grid gap-6 md:grid-cols-3">
          {benefits.map((b) => <li key={b.title} className="border-t border-gold pt-4"><h3 className="font-sans text-base font-semibold">{b.title}</h3><p className="mt-1 text-sm text-muted">{b.text}</p></li>)}
        </ul>
      </section>

      {care?.body ? (
        <section className="bg-white py-16" aria-labelledby="care"><div className="mx-auto max-w-3xl px-4"><h2 id="care" className="text-3xl md:text-4xl">{care.title ?? 'Wig care guide'}</h2>
          <p className="mt-4 whitespace-pre-line leading-relaxed">{care.body}</p>{care.href ? <Link href={care.href} className="btn-outline mt-6">Read the guide</Link> : null}</div></section>
      ) : null}

      <section className="mx-auto max-w-3xl px-4 py-16 text-center" aria-labelledby="story">
        <h2 id="story" className="text-3xl md:text-4xl">{BRAND.supporting}</h2>
        <p className="mt-4 leading-relaxed text-muted">GLAMS BY LEE brings together stylish wigs, hair extensions, bundles, accessories and wig-care products for customers in Ghana and around the world, with attentive service from first message to delivery.</p>
        <Link href="/about" className="btn-outline mt-6">Our story</Link>
      </section>

      <section className="bg-ivory pb-16" aria-labelledby="news">
        <div className="mx-auto max-w-xl border border-line bg-ink px-6 py-10 text-center text-ivory"><h2 id="news" className="text-3xl">New arrivals, first</h2><p className="mt-2 text-sm text-ivory/75">Join the list for new styles and care tips.</p><div className="mx-auto max-w-sm text-left"><NewsletterForm /></div></div>
      </section>
    </main>
  );
}
