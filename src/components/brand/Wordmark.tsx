import { BRAND } from '@/lib/brand';

type Tone = 'light' | 'dark' | 'gold';
type Variant = 'stacked' | 'compact';

/** Outlined SVG artwork from /public/brand (built by scripts/build_logo.py). */
export function Wordmark({ tone = 'dark', variant = 'stacked', className }: { tone?: Tone; variant?: Variant; className?: string }) {
  const src = variant === 'compact' ? `/brand/logo-compact-${tone}.svg` : `/brand/logo-${tone}.svg`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={BRAND.name} className={className} />;
}
