import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (<><Header /><div id="main">{children}</div><Footer /></>);
}
