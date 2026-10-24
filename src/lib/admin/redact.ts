const SENSITIVE = /pass(word)?|secret|token|api[-_]?key|authorization|card|cvv|pin\b|private/i;

/** Replaces values of sensitive-looking keys, recursively. */
export function redactMetadata(value: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 4) return {};
  return Object.fromEntries(Object.entries(value).map(([k, v]) => {
    if (SENSITIVE.test(k)) return [k, '[redacted]'];
    if (v && typeof v === 'object' && !Array.isArray(v)) return [k, redactMetadata(v as Record<string, unknown>, depth + 1)];
    if (typeof v === 'string' && v.length > 500) return [k, `${v.slice(0, 500)}…`];
    return [k, v];
  }));
}
