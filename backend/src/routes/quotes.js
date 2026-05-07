import { Router } from 'express';
import { db, FieldValue } from '../lib/firebase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { createNotification, notifyRole } from '../utils/notifications.js';

const router = Router();

// List quotations
router.get('/', authenticate, async (req, res) => {
  const { ticket_id, status } = req.query;
  let q = db.collection('quotations').orderBy('created_at', 'desc');
  if (req.user.profile?.role === 'contractor') q = q.where('contractor_id', '==', req.user.uid);
  if (ticket_id) q = q.where('ticket_id', '==', ticket_id);
  if (status) q = q.where('status', '==', status);

  const snap = await q.get();
  const quotations = await Promise.all(snap.docs.map(async (d) => {
    const itemsSnap = await d.ref.collection('items').get();
    return { id: d.id, ...d.data(), items: itemsSnap.docs.map((i) => ({ id: i.id, ...i.data() })) };
  }));

  res.json({ quotations });
});

// Submit quotation (contractor)
router.post('/', authenticate, requireRole('contractor'), async (req, res) => {
  const { ticket_id, items, valid_until, notes, estimated_days } = req.body;
  if (!ticket_id || !items?.length) return res.status(400).json({ error: 'ticket_id and items required' });

  const ticketSnap = await db.collection('tickets').doc(ticket_id).get();
  if (!ticketSnap.exists) return res.status(404).json({ error: 'Ticket not found' });

  const total_amount = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);

  const quoteRef = await db.collection('quotations').add({
    ticket_id,
    ticket_title: ticketSnap.data().title,
    contractor_id: req.user.uid,
    contractor_name: req.user.profile?.full_name || '',
    company_name: req.user.profile?.company_name || null,
    total_amount,
    valid_until: valid_until || null,
    estimated_days: estimated_days ? Number(estimated_days) : null,
    notes: notes || null,
    status: 'submitted',
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  const batch = db.batch();
  items.forEach((item) => {
    const itemRef = quoteRef.collection('items').doc();
    batch.set(itemRef, {
      description: item.description,
      item_type: item.item_type || 'labour',
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      total: Number(item.quantity) * Number(item.unit_price),
    });
  });
  await batch.commit();

  if (ticketSnap.data().status === 'pending') {
    await db.collection('tickets').doc(ticket_id).update({ status: 'awaiting_quote', updated_at: FieldValue.serverTimestamp() });
  }

  await logAudit({ userId: req.user.uid, action: 'quote_submitted', entityType: 'quotation', entityId: quoteRef.id, meta: { ticket_id, total_amount } });
  await notifyRole('property_manager', { title: 'New Quote Received', message: `£${total_amount.toFixed(2)} quote for "${ticketSnap.data().title}"`, type: 'quote_submitted', entityType: 'quotation', entityId: quoteRef.id });

  const snap = await quoteRef.get();
  res.status(201).json({ quotation: { id: snap.id, ...snap.data() } });
});

// Approve quote
router.post('/:id/approve', authenticate, requireRole('property_manager', 'property_owner', 'admin'), async (req, res) => {
  const { notes } = req.body;
  const quoteSnap = await db.collection('quotations').doc(req.params.id).get();
  if (!quoteSnap.exists) return res.status(404).json({ error: 'Quotation not found' });

  const quote = quoteSnap.data();
  const needsOwnerApproval = quote.total_amount > 500 && req.user.profile?.role === 'property_manager';
  const newStatus = needsOwnerApproval ? 'pending_owner_approval' : 'approved';

  await db.collection('quotations').doc(req.params.id).update({ status: newStatus, updated_at: FieldValue.serverTimestamp() });

  if (!needsOwnerApproval) {
    // Reject other quotes for this ticket
    const others = await db.collection('quotations').where('ticket_id', '==', quote.ticket_id).get();
    const batch = db.batch();
    others.docs.forEach((d) => {
      if (d.id !== req.params.id) batch.update(d.ref, { status: 'rejected' });
    });
    batch.update(db.collection('tickets').doc(quote.ticket_id), {
      status: 'approved',
      assigned_contractor: quote.contractor_id,
      assigned_contractor_name: quote.contractor_name,
      updated_at: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }

  await logAudit({ userId: req.user.uid, action: 'quote_approved', entityType: 'quotation', entityId: req.params.id });

  await createNotification({
    userId: quote.contractor_id,
    title: needsOwnerApproval ? 'Quote Under Review' : 'Quote Approved!',
    message: needsOwnerApproval ? 'Your quote is pending owner approval' : `Your quote for "${quote.ticket_title}" has been approved`,
    type: 'quote_approved', entityType: 'quotation', entityId: req.params.id,
  });

  if (needsOwnerApproval) {
    await notifyRole('property_owner', { title: 'Quote Approval Required', message: `£${quote.total_amount.toFixed(2)} requires your approval`, type: 'quote_pending_owner', entityType: 'quotation', entityId: req.params.id });
  }

  res.json({ status: newStatus });
});

// Reject quote
router.post('/:id/reject', authenticate, requireRole('property_manager', 'property_owner', 'admin'), async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: 'reason required' });

  const quoteSnap = await db.collection('quotations').doc(req.params.id).get();
  if (!quoteSnap.exists) return res.status(404).json({ error: 'Quotation not found' });

  await db.collection('quotations').doc(req.params.id).update({ status: 'rejected', rejection_reason: reason, updated_at: FieldValue.serverTimestamp() });

  await createNotification({
    userId: quoteSnap.data().contractor_id,
    title: 'Quote Rejected',
    message: `Your quote for "${quoteSnap.data().ticket_title}" was rejected: ${reason}`,
    type: 'quote_rejected', entityType: 'quotation', entityId: req.params.id,
  });

  res.json({ message: 'Quote rejected' });
});

export default router;
