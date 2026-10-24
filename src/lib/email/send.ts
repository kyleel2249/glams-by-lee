export interface OutgoingEmail { to: string; subject: string; html: string; text: string }
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Sends through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). Swap this one function to change provider. */
export async function sendEmail(msg: OutgoingEmail, cfg: { apiKey: string; from: string }, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `Email provider returned ${res.status}` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'send failed' }; }
}
