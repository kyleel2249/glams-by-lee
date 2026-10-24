/** Per-instance sliding-window limiter. Slows casual abuse; put an edge/KV limiter in front before heavy traffic. */
const buckets = new Map<string, number[]>();

export function rateLimited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return recent.length > max;
}
export const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
