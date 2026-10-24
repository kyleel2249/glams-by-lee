/** Only letters, digits and @ . _ - survive: keeps free text safe inside a PostgREST filter expression. */
export const safeQuery = (q: string | null | undefined) => (q ?? '').replace(/[^A-Za-z0-9@._-]/g, '').slice(0, 60);
export const isDate = (s: string | null | undefined): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)));
