import { checkGrounding } from './guard';
import { buildSystemPrompt } from './prompt';
import { selectProducts } from './retrieve';
import { COMPLAINT, ruleBasedAnswer, toRef } from './rules';
import { cleanConversation } from './sanitize';
import type { AssistantProvider, AssistantReply, Knowledge } from './types';

const UNSURE = /\b(not sure|don'?t know|do not know|cannot confirm|can'?t confirm|contact (?:us|the team)|whatsapp)\b/i;

/**
 * Answers one customer question. Never throws for provider problems: falls back to free rule-based answers that use only shop data.
 * `provider` is null when AI is switched off, not configured, or over its daily limit.
 */
export async function answerQuestion(
  input: { messages: { role: string; content: string }[]; knowledge: Knowledge; provider: AssistantProvider | null; now?: () => number },
): Promise<AssistantReply> {
  const now = input.now ?? Date.now;
  const messages = cleanConversation(input.messages);
  const last = messages[messages.length - 1];
  if (!last) return { answer: 'Ask me about our wigs, delivery, returns or your order.', products: [], handoff: false, source: 'rules', outcome: 'answered' };

  const k = input.knowledge;
  const relevant = selectProducts(last.content, k.products, 6);
  const rules = () => ruleBasedAnswer(last.content, k);

  if (!input.provider) { const r = rules(); return { ...r, handoff: r.handoff || COMPLAINT.test(last.content), source: 'rules', outcome: 'fallback' }; }

  const started = now();
  try {
    const res = await input.provider.complete({ system: buildSystemPrompt(k, relevant), messages });
    const latencyMs = Math.max(0, now() - started);
    const verdict = checkGrounding(res.text, k);
    if (!verdict.ok) { const r = rules(); return { ...r, handoff: true, source: 'rules', outcome: 'blocked', usage: { inputTokens: res.inputTokens, outputTokens: res.outputTokens, latencyMs, model: res.model } }; }
    return {
      answer: res.text, products: relevant.slice(0, 3).map(toRef), handoff: UNSURE.test(res.text) || COMPLAINT.test(last.content), source: 'ai', outcome: 'answered',
      usage: { inputTokens: res.inputTokens, outputTokens: res.outputTokens, latencyMs, model: res.model },
    };
  } catch (e) {
    console.error('assistant provider failed', e instanceof Error ? e.message : e);
    const r = rules();
    return { ...r, handoff: r.handoff || COMPLAINT.test(last.content), source: 'rules', outcome: 'fallback' };
  }
}
