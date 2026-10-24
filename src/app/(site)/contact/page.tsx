import type { Metadata } from 'next';
import { getSettings } from '@/lib/catalog';
import { whatsAppLink } from '@/lib/whatsapp';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Contact', description: 'Contact GLAMS BY LEE on WhatsApp or email.', alternates: { canonical: '/contact' } };

export default async function Contact() {
  const s = await getSettings();
  const wa = whatsAppLink(s.whatsappNumber, 'Hello GLAMS BY LEE, I have a question.');
  return (
    <main className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="text-4xl md:text-6xl">Contact</h1>
      {wa || s.contactEmail ? (
        <ul className="mt-8 space-y-4">
          {wa ? <li><a href={wa} target="_blank" rel="noopener noreferrer" className="btn-gold">Chat on WhatsApp</a></li> : null}
          {s.contactEmail ? <li><a href={`mailto:${s.contactEmail}`} className="underline">{s.contactEmail}</a></li> : null}
          {s.supportHours ? <li className="text-muted">{s.supportHours}</li> : null}
        </ul>
      ) : <p className="mt-6 text-muted">Our contact details are being set up. Please check back shortly.</p>}
      <p className="mt-10 text-sm text-muted">Please do not send card numbers or passwords in messages.</p>
    </main>
  );
}
