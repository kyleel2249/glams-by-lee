import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ShoppingAssistant } from '@/components/assistant/ShoppingAssistant';
import { getSettings } from '@/lib/catalog';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (<><Header /><div id="main">{children}</div><Footer />{settings.assistantEnabled ? <ShoppingAssistant /> : null}</>);
}
