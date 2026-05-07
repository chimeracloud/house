import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { db, FieldValue } from '../lib/firebase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { createNotification, notifyRole } from '../utils/notifications.js';

const router = Router();

const VALID_STATUSES = ['pending','awaiting_quote','approved','in_progress','awaiting_inspection','completed','rejected','paid'];
const VALID_PRIORITIES = ['low','medium','high','urgent'];

// List tickets
router.get('/', authenticate, async (req, res) => {
  const { status, priority, limit = 50 } = req.query;
  let q = db.collection('tickets').orderBy('created_at', 'desc').limit(Number(limit));
  if (status) q = q.where('status', '==', status);
  if (priority) q = q.where('priority', '==', priority);

  const snap = await q.get();
  const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  res.json({ tickets, total: tickets.length });
});

// Get single ticket with subcollections
router.get('/:id', authenticate, async (req, res) => {
  const ticketRef = db.collection('tickets').doc(req.params.id);
  const [ticketSnap, attachSnap, commentSnap, quoteSnap, approvalSnap] = await Promise.all([
    ticketRef.get(),
    ticketRef.collection('attachments').orderBy('created_at', 'desc').get(),
    ticketRef.collection('comments').orderBy('created_at', 'asc').get(),
    db.collection('quotations').where('ticket_id', '==', req.params.id).get(),
    ticketRef.collection('approvals').orderBy('created_at', 'desc').get(),
  ]);

  if (!ticketSnap.exists) return res.status(404).json({ error: 'Ticket not found' });

  const ticket = { id: ticketSnap.id, ...ticketSnap.data() };
  ticket.attachments = attachSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  ticket.comments = commentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  ticket.approvals = approvalSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Enrich quotes with items
  ticket.quotations = await Promise.all(quoteSnap.docs.map(async (d) => {
    const itemsSnap = await d.ref.collection('items').get();
    return {
      id: d.id, ...d.data(),
      items: itemsSnap.docs.map((i) => ({ id: i.id, ...i.data() })),
    };
  }));

  res.json({ ticket });
});

// Create ticket
router.post('/', authenticate, async (req, res) => {
  const { title, description, priority = 'medium', room_id, deadline, category, estimated_cost } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'title and description are required' });
  }

  const docRef = await db.collection('tickets').add({
    title: title.trim(),
    description: description.trim(),
    priority,
    status: 'pending',
    room_id: room_id || null,
    category: category || null,
    deadline: deadline || null,
    estimated_cost: estimated_cost ? Number(estimated_cost) : null,
    created_by: req.user.uid,
    created_by_name: req.user.profile?.full_name || '',
    assigned_contractor: null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  await logAudit({ userId: req.user.uid, action: 'ticket_created', entityType: 'ticket', entityId: docRef.id, meta: { title, priority } });
  await notifyRole('property_manager', { title: 'New Maintenance Ticket', message: `"${title}" logged with ${priority} priority`, type: 'ticket_created', entityType: 'ticket', entityId: docRef.id });

  const snap = await docRef.get();
  res.status(201).json({ ticket: { id: snap.id, ...snap.data() } });
});

// Update ticket
router.patch('/:id', authenticate, requireRole('property_manager', 'property_owner', 'admin'), async (req, res) => {
  const allowed = ['title','description','priority','status','room_id','assigned_contractor','deadline','category','estimated_cost'];
  const updates = { updated_at: FieldValue.serverTimestamp() };
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  await db.collection('tickets').doc(req.params.id).update(updates);
  await logAudit({ userId: req.user.uid, action: 'ticket_updated', entityType: 'ticket', entityId: req.params.id, meta: updates });

  const snap = await db.collection('tickets').doc(req.params.id).get();
  res.json({ ticket: { id: snap.id, ...snap.data() } });
});

// Add comment
router.post('/:id/comments', authenticate, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content required' });

  const ref = await db.collection('tickets').doc(req.params.id).collection('comments').add({
    content: content.trim(),
    author_id: req.user.uid,
    author_name: req.user.profile?.full_name || '',
    author_role: req.user.profile?.role || '',
    created_at: FieldValue.serverTimestamp(),
  });

  const snap = await ref.get();
  res.status(201).json({ comment: { id: snap.id, ...snap.data() } });
});

// Get signed upload URL for attachment
router.post('/:id/attachments', authenticate, async (req, res) => {
  const { file_name, file_type, label, mime_type } = req.body;
  if (!file_name) return res.status(400).json({ error: 'file_name required' });

  const { storage } = await import('../lib/firebase.js');
  const path = `tickets/${req.params.id}/${Date.now()}_${file_name}`;
  const file = storage.bucket().file(path);

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType: mime_type || 'application/octet-stream',
  });

  const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${path}`;

  const ref = await db.collection('tickets').doc(req.params.id).collection('attachments').add({
    file_name, file_url: publicUrl, file_path: path,
    file_type: file_type || 'image', label: label || null,
    mime_type: mime_type || null,
    uploaded_by: req.user.uid,
    created_at: FieldValue.serverTimestamp(),
  });

  const snap = await ref.get();
  res.status(201).json({ attachment: { id: snap.id, ...snap.data() }, upload_url: uploadUrl });
});

// Inspection sign-off
router.post('/:id/signoff', authenticate, requireRole('property_manager', 'property_owner', 'admin'), async (req, res) => {
  const { notes, passed } = req.body;
  const ticketSnap = await db.collection('tickets').doc(req.params.id).get();
  if (!ticketSnap.exists) return res.status(404).json({ error: 'Ticket not found' });

  const ticket = ticketSnap.data();
  if (ticket.status !== 'awaiting_inspection') {
    return res.status(400).json({ error: 'Ticket is not awaiting inspection' });
  }

  const newStatus = passed ? 'completed' : 'in_progress';
  const ticketRef = db.collection('tickets').doc(req.params.id);

  await Promise.all([
    ticketRef.update({ status: newStatus, updated_at: FieldValue.serverTimestamp() }),
    ticketRef.collection('approvals').add({
      approver_id: req.user.uid,
      approver_name: req.user.profile?.full_name || '',
      type: 'inspection',
      decision: passed ? 'approved' : 'rejected',
      notes: notes || null,
      created_at: FieldValue.serverTimestamp(),
    }),
  ]);

  await logAudit({ userId: req.user.uid, action: passed ? 'inspection_passed' : 'inspection_failed', entityType: 'ticket', entityId: req.params.id });

  if (ticket.assigned_contractor) {
    await createNotification({
      userId: ticket.assigned_contractor,
      title: passed ? 'Work Signed Off' : 'Re-work Required',
      message: passed ? `Your work on "${ticket.title}" has been approved` : `"${ticket.title}" requires additional work`,
      type: passed ? 'inspection_passed' : 'inspection_failed',
      entityType: 'ticket', entityId: req.params.id,
    });
  }

  res.json({ status: newStatus });
});

export default router;
