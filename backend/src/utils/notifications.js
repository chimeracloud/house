import { supabase } from '../lib/supabase.js';

export async function createNotification({ userId, title, message, type, entityType, entityId }) {
  await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    entity_type: entityType,
    entity_id: entityId,
  });
}

export async function notifyRole(role, { title, message, type, entityType, entityId }) {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', role);

  if (!profiles?.length) return;

  const notifications = profiles.map((p) => ({
    user_id: p.id,
    title,
    message,
    type,
    entity_type: entityType,
    entity_id: entityId,
  }));

  await supabase.from('notifications').insert(notifications);
}
