import type { Metadata } from 'next';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s | GLAMS BY LEE Admin' }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div id="main" className="min-h-screen bg-ivory">{children}</div>;
}
