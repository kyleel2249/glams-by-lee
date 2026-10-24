import Link from 'next/link';
import { Wordmark } from '@/components/brand/Wordmark';
import { BRAND } from '@/lib/brand';
import { getSettings } from '@/lib/catalog';
import { whatsAppLink } from '@/lib/whatsapp';
import { NewsletterForm } from '@/components/shop/NewsletterForm';

const POLICIES = [
  ['shipping', 'Shipping policy'], ['returns', 'Returns and refunds'], ['privacy', 'Privacy policy'], ['terms', 'Terms and conditions'],
] as const;

export async function Footer() {
  const s = await getSettings();
  const wa = whatsAppLink(s.whatsappNumber, 'Hello GLAMS BY LEE, I have a question.');
  const social = Object.entries(s.socialLinks).filter(([, url]) => typeof url === 'string' && url.startsWith('https://'));
  return (
    <footer className="bg-ink text-ivory">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Wordmark tone="gold" className="h-20 w-auto" />
          <p className="mt-4 max-w-xs font-display text-xl text-ivory/90">{BRAND.tagline}</p>
        </div>
        <nav aria-label="Shop" className="text-sm">
          <h2 className="font-sans text-sm font-semibold text-gold-soft">Shop</h2>
          <ul className="mt-3 space-y-2">
            <li><Link href="/shop" className="hover:text-gold-soft">All products</Link></li>
            <li><Link href="/find-your-wig" className="hover:text-gold-soft">Find your wig</Link></li>
          </ul>
        </nav>
        <nav aria-label="Customer service" className="text-sm">
          <h2 className="font-sans text-sm font-semibold text-gold-soft">Customer service</h2>
          <ul className="mt-3 space-y-2">
            <li><Link href="/contact" className="hover:text-gold-soft">Contact</Link></li>
            <li><Link href="/about" className="hover:text-gold-soft">About</Link></li>
            {POLICIES.map(([slug, label]) => <li key={slug}><Link href={`/policies/${slug}`} className="hover:text-gold-soft">{label}</Link></li>)}
          </ul>
          <ul className="mt-4 space-y-2">
            {wa ? <li><a href={wa} target="_blank" rel="noopener noreferrer" className="text-gold-soft hover:text-ivory">Chat on WhatsApp</a></li> : null}
            {s.contactEmail ? <li><a href={`mailto:${s.contactEmail}`} className="hover:text-gold-soft">{s.contactEmail}</a></li> : null}
            {s.supportHours ? <li className="text-ivory/70">{s.supportHours}</li> : null}
          </ul>
        </nav>
        <div className="text-sm">
          <h2 className="font-sans text-sm font-semibold text-gold-soft">Stay in the loop</h2>
          <p className="mt-3 text-ivory/70">New arrivals and care tips. Unsubscribe any time.</p>
          <NewsletterForm />
          {social.length ? (
            <ul className="mt-6 flex flex-wrap gap-4">
              {social.map(([name, url]) => <li key={name}><a href={url} target="_blank" rel="noopener noreferrer" className="capitalize hover:text-gold-soft">{name}</a></li>)}
            </ul>
          ) : null}
        </div>
      </div>
      <p className="border-t border-ivory/15 px-4 py-5 text-center text-xs text-ivory/60">© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
    </footer>
  );
}
