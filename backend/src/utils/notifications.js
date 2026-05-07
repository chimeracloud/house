import { db, FieldValue } from '../lib/firebase.js';

export async function createNotification({ userId, title, message, type, entityType, entityId }) {
  await db.collection('notifications').add({
    user_id: userId,
    title,
    message,
    type,
    entity_type: entityType,
    entity_id: entityId || null,
    read: false,
    created_at: FieldValue.serverTimestamp(),
  });
}

export async function notifyRole(role, { title, message, type, entityType, entityId }) {
  const snap = await db.collection('profiles').where('role', '==', role).get();
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    const ref = db.collection('notifications').doc();
    batch.set(ref, {
      user_id: doc.id,
      title, message, type,
      entity_type: entityType,
      entity_id: entityId || null,
      read: false,
      created_at: FieldValue.serverTimestamp(),
    });
  });
  if (!snap.empty) await batch.commit();
}
