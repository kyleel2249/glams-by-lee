import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — Premium Wigs & Hair`, template: `%s | ${BRAND.name}` },
  description: 'Premium wigs, hair bundles and hair essentials for Ghana and international customers.',
  icons: { icon: '/brand/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#171514' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
