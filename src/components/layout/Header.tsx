import Link from 'next/link';
import { Wordmark } from '@/components/brand/Wordmark';
import { getSettings, getSiteContent } from '@/lib/catalog';
import { whatsAppLink } from '@/lib/whatsapp';
import { BagCount } from '@/components/shop/BagCount';
import { AccountLink } from './AccountLink';

const NAV = [
  { href: '/shop', label: 'Shop' },
  { href: '/find-your-wig', label: 'Find Your Wig' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export async function Header() {
  const [settings, bar] = await Promise.all([getSettings(), getSiteContent<{ enabled?: boolean; text?: string }>('announcement_bar')]);
  const wa = whatsAppLink(settings.whatsappNumber, 'Hello GLAMS BY LEE, I have a question.');
  return (
    <header className="sticky top-0 z-40">
      {bar?.enabled && bar.text ? <p className="bg-charcoal px-4 py-2 text-center text-sm text-ivory">{bar.text}</p> : null}
      <div className="border-b border-gold/30 bg-ink text-ivory">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <details className="group relative md:hidden">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center" aria-label="Menu">
              <span aria-hidden className="block h-3.5 w-5 border-y-2 border-ivory before:mt-[5px] before:block before:h-0.5 before:bg-ivory" />
            </summary>
            <nav aria-label="Mobile" className="absolute left-0 top-12 w-64 border border-gold/30 bg-ink p-2 shadow-lift">
              {NAV.map((n) => <Link key={n.href} href={n.href} className="block px-4 py-3 text-sm hover:bg-charcoal">{n.label}</Link>)}
              {wa ? <a href={wa} className="block px-4 py-3 text-sm text-gold-soft hover:bg-charcoal" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a> : null}
            </nav>
          </details>
          <Link href="/" aria-label="GLAMS BY LEE home" className="shrink-0"><Wordmark tone="light" variant="compact" className="h-7 w-auto md:h-8" /></Link>
          <nav aria-label="Main" className="ml-8 hidden gap-7 text-sm md:flex">
            {NAV.map((n) => <Link key={n.href} href={n.href} className="py-2 hover:text-gold-soft">{n.label}</Link>)}
          </nav>
          <form action="/shop" role="search" className="ml-auto hidden min-w-0 flex-1 md:block md:max-w-xs">
            <label className="sr-only" htmlFor="site-search">Search products</label>
            <input id="site-search" name="q" type="search" placeholder="Search wigs, bundles, care" className="h-10 w-full border border-ivory/30 bg-charcoal px-3 text-sm text-ivory placeholder:text-ivory/60" />
          </form>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Link href="/shop?focus=search" className="flex h-11 w-11 items-center justify-center text-sm md:hidden" aria-label="Search">
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </Link>
            {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="hidden h-11 items-center px-3 text-sm text-gold-soft hover:text-ivory md:flex">WhatsApp</a> : null}
            <Link href="/account/wishlist" className="hidden h-11 w-11 items-center justify-center hover:text-gold-soft sm:flex" aria-label="Wishlist">
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>
            </Link>
            <AccountLink />
            <Link href="/cart" className="flex h-11 items-center gap-2 px-3 text-sm hover:text-gold-soft" aria-label="Shopping bag">
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>
              <span className="hidden sm:inline">Bag</span><BagCount />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
