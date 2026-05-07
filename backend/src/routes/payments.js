import { Router } from 'express';
import { db, FieldValue } from '../lib/firebase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const { status } = req.query;
  let q = db.collection('payments').orderBy('created_at', 'desc');
  if (req.user.profile?.role === 'contractor') q = q.where('contractor_id', '==', req.user.uid);
  if (status) q = q.where('status', '==', status);

  const snap = await q.get();
  res.json({ payments: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
});

router.post('/', authenticate, requireRole('property_owner', 'admin', 'property_manager'), async (req, res) => {
  const { ticket_id, contractor_id, amount, payment_method, quote_id, reference, notes } = req.body;
  if (!ticket_id || !contractor_id || !amount) return res.status(400).json({ error: 'ticket_id, contractor_id and amount required' });

  const ticketSnap = await db.collection('tickets').doc(ticket_id).get();
  if (!ticketSnap.exists) return res.status(404).json({ error: 'Ticket not found' });
  if (ticketSnap.data().status !== 'completed') return res.status(400).json({ error: 'Ticket must be completed first' });

  const ref = await db.collection('payments').add({
    ticket_id, ticket_title: ticketSnap.data().title,
    contractor_id, quote_id: quote_id || null,
    amount: Number(amount),
    payment_method: payment_method || null,
    reference: reference || null, notes: notes || null,
    status: 'pending',
    created_by: req.user.uid,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  await logAudit({ userId: req.user.uid, action: 'payment_created', entityType: 'payment', entityId: ref.id, meta: { amount, ticket_id } });
  const snap = await ref.get();
  res.status(201).json({ payment: { id: snap.id, ...snap.data() } });
});

router.post('/:id/authorize', authenticate, requireRole('property_owner', 'admin'), async (req, res) => {
  const { notes } = req.body;
  const paymentSnap = await db.collection('payments').doc(req.params.id).get();
  if (!paymentSnap.exists) return res.status(404).json({ error: 'Payment not found' });
  if (paymentSnap.data().status !== 'pending') return res.status(400).json({ error: 'Payment not pending' });

  const payment = paymentSnap.data();
  await db.collection('payments').doc(req.params.id).update({
    status: 'authorized', authorized_by: req.user.uid,
    authorized_at: FieldValue.serverTimestamp(),
    notes: notes || null, updated_at: FieldValue.serverTimestamp(),
  });
  await db.collection('tickets').doc(payment.ticket_id).update({ status: 'paid', updated_at: FieldValue.serverTimestamp() });

  await createNotification({
    userId: payment.contractor_id,
    title: 'Payment Authorized',
    message: `Payment of £${Number(payment.amount).toFixed(2)} for "${payment.ticket_title}" has been authorized`,
    type: 'payment_authorized', entityType: 'payment', entityId: req.params.id,
  });

  await logAudit({ userId: req.user.uid, action: 'payment_authorized', entityType: 'payment', entityId: req.params.id });
  res.json({ status: 'authorized' });
});

router.post('/:id/paid', authenticate, requireRole('property_owner', 'admin', 'property_manager'), async (req, res) => {
  const { transaction_ref } = req.body;
  const paymentSnap = await db.collection('payments').doc(req.params.id).get();
  if (!paymentSnap.exists) return res.status(404).json({ error: 'Payment not found' });
  if (paymentSnap.data().status !== 'authorized') return res.status(400).json({ error: 'Payment must be authorized first' });

  await db.collection('payments').doc(req.params.id).update({
    status: 'paid', transaction_ref: transaction_ref || null,
    paid_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp(),
  });

  await createNotification({
    userId: paymentSnap.data().contractor_id,
    title: 'Payment Sent',
    message: `Your payment of £${Number(paymentSnap.data().amount).toFixed(2)} has been sent`,
    type: 'payment_sent', entityType: 'payment', entityId: req.params.id,
  });

  const snap = await db.collection('payments').doc(req.params.id).get();
  res.json({ payment: { id: snap.id, ...snap.data() } });
});

export default router;
