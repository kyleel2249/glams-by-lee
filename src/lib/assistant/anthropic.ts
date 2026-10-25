import type { AssistantProvider, ChatMessage, ProviderResult } from './types';

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export const DEFAULT_MODEL = 'claude-haiku-5-5';

/** Calls the Anthropic Messages API from the server. The key never reaches the browser and no message text is logged. */
export function createAnthropicProvider(cfg: { apiKey: string; model?: string; timeoutMs?: number; baseUrl?: string }, fetchImpl: FetchLike = fetch as unknown as FetchLike): AssistantProvider {
  const model = cfg.model || DEFAULT_MODEL;
  return {
    async complete({ system, messages }: { system: string; messages: ChatMessage[] }): Promise<ProviderResult> {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs ?? 20_000);
      try {
        const res = await fetchImpl(`${(cfg.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`, {
          method: 'POST', signal: ctl.signal,
          headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model, max_tokens: 400, temperature: 0.2, system, messages }),
        });
        if (!res.ok) throw new Error(`Assistant provider returned ${res.status}`);
        const data = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
        const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
        if (!text) throw new Error('Assistant provider returned no text');
        return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0, model };
      } finally { clearTimeout(timer); }
    },
  };
}
