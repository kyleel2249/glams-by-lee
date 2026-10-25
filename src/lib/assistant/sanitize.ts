import type { ChatMessage } from './types';

const MAX_CHARS = 500, MAX_TURNS = 8;

/** Customer text is untrusted: strip control characters, collapse whitespace, cap length. */
export const cleanText = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);

/** Keeps the last few turns, alternating roles, ending with a user message. Anything else is dropped. */
export function cleanConversation(raw: { role: string; content: string }[]): ChatMessage[] {
  const turns = raw.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: cleanText(m.content) })).filter((m) => m.content.length > 0).slice(-MAX_TURNS);
  while (turns.length && turns[0].role !== 'user') turns.shift();
  const out: ChatMessage[] = [];
  for (const t of turns) { if (out.length && out[out.length - 1].role === t.role) out[out.length - 1] = t; else out.push(t); }
  return out[out.length - 1]?.role === 'user' ? out : [];
}

/** Data placed in the prompt is serialised as JSON with angle brackets escaped, so product or policy text can never close the context block. */
export const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
