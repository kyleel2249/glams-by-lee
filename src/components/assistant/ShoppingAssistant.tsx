'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface Ref { name: string; slug: string; priceText: string | null; availability: string }
interface Msg { role: 'user' | 'assistant'; content: string; products?: Ref[]; handoff?: boolean; source?: 'ai' | 'rules' }
const SUGGESTIONS = ['Help me choose a wig', 'How much is delivery?', 'What is your returns policy?', 'Where is my order?'];
const AVAIL: Record<string, string> = { in_stock: 'In stock', low_stock: 'Low stock', backorder: 'Available to order', out_of_stock: 'Out of stock' };

/** Floating helper. Uses the native <dialog> element, so focus is trapped, Escape closes it and focus returns to the button. */
export function ShoppingAssistant() {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wa, setWa] = useState<string | null>(null);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [msgs, busy]);

  async function send(q: string) {
    const content = q.trim().slice(0, 500);
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content }];
    setMsgs(next); setText(''); setBusy(true); setError(null);
    try {
      const r = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.map(({ role, content: c }) => ({ role, content: c })) }) });
      const d = await r.json().catch(() => ({}));
      if (d.whatsappUrl) setWa(d.whatsappUrl);
      if (!r.ok) { setError(d.error ?? 'Sorry, something went wrong. Please try again.'); return; }
      setMsgs([...next, { role: 'assistant', content: d.answer, products: d.products, handoff: d.handoff, source: d.source }]);
    } catch { setError('No connection. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="fixed bottom-4 right-4 z-30 flex min-h-[48px] items-center gap-2 bg-ink px-5 text-sm font-medium text-ivory shadow-lift hover:bg-charcoal" aria-haspopup="dialog">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>
        Ask us
      </button>
      <dialog ref={dialog} aria-labelledby="assistant-title" className="m-0 ml-auto h-[100dvh] max-h-[100dvh] w-full max-w-md border-0 bg-ivory p-0 text-ink backdrop:bg-ink/60 sm:m-4 sm:ml-auto sm:mt-auto sm:h-[36rem] sm:max-h-[85dvh]" onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between bg-ink px-4 py-3 text-ivory">
            <h2 id="assistant-title" className="font-display text-xl">Shopping assistant</h2>
            <div className="flex items-center gap-1">
              {msgs.length ? <button type="button" onClick={() => { setMsgs([]); setError(null); }} className="min-h-[44px] px-3 text-sm underline">New chat</button> : null}
              <button type="button" onClick={() => dialog.current?.close()} className="flex h-11 w-11 items-center justify-center text-xl" aria-label="Close assistant">×</button>
            </div>
          </header>
          <p className="border-b border-line bg-white px-4 py-2 text-xs text-muted">Answers come from our shop information. AI can make mistakes, so prices, stock and delivery are confirmed at checkout. Please do not share passwords or card numbers.</p>
          <div ref={list} role="log" aria-live="polite" aria-label="Conversation" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!msgs.length ? (
              <div>
                <p className="text-sm">Hello! Ask me about wigs, delivery, returns or your order.</p>
                <ul className="mt-3 flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <li key={s}><button type="button" onClick={() => send(s)} className="min-h-[44px] border border-line bg-white px-3 text-sm hover:border-ink">{s}</button></li>)}</ul>
              </div>
            ) : null}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'ml-8 bg-ink px-3 py-2 text-sm text-ivory' : 'mr-8 border border-line bg-white px-3 py-2 text-sm'}>
                <p className="whitespace-pre-line">{m.content}</p>
                {m.products?.length ? <ul className="mt-2 space-y-1">{m.products.map((p) => <li key={p.slug}><Link href={`/products/${p.slug}`} onClick={() => dialog.current?.close()} className="underline">{p.name}</Link><span className="text-muted">{p.priceText ? ` · ${p.priceText}` : ''} · {AVAIL[p.availability] ?? p.availability}</span></li>)}</ul> : null}
                {m.role === 'assistant' && m.source === 'ai' ? <p className="mt-2 text-xs text-muted">AI-generated answer.</p> : null}
                {m.handoff ? <p className="mt-3 flex flex-wrap gap-2">{wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-gold !min-h-[40px] !px-4">Chat with our team on WhatsApp</a> : null}<Link href="/contact" onClick={() => dialog.current?.close()} className="btn-outline !min-h-[40px] !px-4">Contact us</Link></p> : null}
              </div>
            ))}
            {busy ? <p role="status" className="mr-8 border border-line bg-white px-3 py-2 text-sm text-muted">Thinking…</p> : null}
            {error ? <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 border-t border-line bg-white p-3">
            <label htmlFor="assistant-input" className="sr-only">Your question</label>
            <input id="assistant-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} autoComplete="off" placeholder="Type your question" className="field" />
            <button className="btn-gold shrink-0 !px-5 disabled:opacity-50" disabled={busy || !text.trim()}>Send</button>
          </form>
        </div>
      </dialog>
    </>
  );
}
