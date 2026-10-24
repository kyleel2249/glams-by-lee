import 'server-only';
import { createAdmin } from '@/lib/supabase/admin';
import { redactMetadata } from './redact';

/** Records a sensitive staff action. Never put secrets, tokens or card data in metadata (redaction is a safety net, not a licence). */
export async function recordAudit(actorId: string, action: string, resourceType: string, resourceId: string | null, metadata: Record<string, unknown> = {}) {
  const { error } = await createAdmin().from('audit_logs').insert({ actor_id: actorId, action, resource_type: resourceType, resource_id: resourceId, metadata: redactMetadata(metadata) });
  if (error) console.error('audit log failed', action, error.code);
}
