import { db, FieldValue } from '../lib/firebase.js';

export async function logAudit({ userId, action, entityType, entityId, meta = {} }) {
  await db.collection('audit_logs').add({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    metadata: meta,
    created_at: FieldValue.serverTimestamp(),
  });
}
