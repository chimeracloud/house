import { supabase } from '../lib/supabase.js';

export async function logAudit({ userId, action, entityType, entityId, meta = {} }) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: meta,
  });
}
