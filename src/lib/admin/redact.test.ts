import { describe, it, expect } from 'vitest';
import { redactMetadata } from './redact';

describe('redactMetadata', () => {
  it('hides sensitive keys at any depth and truncates long text', () => {
    const out = redactMetadata({ name: 'x', password: 'p', nested: { apiKey: 'k', ok: 1 }, note: 'a'.repeat(900), card_number: '4111' });
    expect(out.password).toBe('[redacted]'); expect((out.nested as Record<string, unknown>).apiKey).toBe('[redacted]'); expect((out.nested as Record<string, unknown>).ok).toBe(1);
    expect(out.card_number).toBe('[redacted]'); expect(out.name).toBe('x'); expect(String(out.note).length).toBe(501);
  });
});
