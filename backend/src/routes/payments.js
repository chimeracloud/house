import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

// List payments
router.get('/', authenticate, async (req, res) => {
  const { ticket_id, status } = req.query;

  let q = supabase
    .from('payments')
    .select(`
      *,
      ticket:maintenance_tickets(id, title),
      contractor:profiles!payments_contractor_id_fkey(id, full_name, company_name),
      authorized_by_profile:profiles!payments_authorized_by_fkey(full_name),
      quotation:quotations(id, total_amount)
    `)
    .order('created_at', { ascending: false });

  if (req.user.profile?.role === 'contractor') {
    q = q.eq('contractor_id', req.user.id);
  }

  if (ticket_id) q = q.eq('ticket_id', ticket_id);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ payments: data });
});

// Create payment record (after owner authorization)
router.post('/',
  authenticate,
  requireRole('property_owner', 'admin', 'property_manager'),
  body('ticket_id').isUUID(),
  body('contractor_id').isUUID(),
  body('amount').isFloat({ min: 0.01 }),
  body('payment_method').isIn(['bank_transfer', 'cash', 'cheque', 'online']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { ticket_id, contractor_id, amount, payment_method, quote_id, reference, notes } = req.body;

    const { data: ticket } = await supabase
      .from('maintenance_tickets')
      .select('id, title, status')
      .eq('id', ticket_id)
      .single();

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status !== 'completed') {
      return res.status(400).json({ error: 'Can only process payment for completed tickets' });
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        ticket_id,
        contractor_id,
        quote_id,
        amount: Number(amount),
        payment_method,
        reference,
        notes,
        status: 'pending',
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    await logAudit({
      userId: req.user.id,
      action: 'payment_created',
      entityType: 'payment',
      entityId: data.id,
      meta: { amount, ticket_id, contractor_id },
    });

    res.status(201).json({ payment: data });
  }
);

// Authorize payment (owner)
router.post('/:id/authorize',
  authenticate,
  requireRole('property_owner', 'admin'),
  async (req, res) => {
    const { notes } = req.body;

    const { data: payment } = await supabase
      .from('payments')
      .select(`*, ticket:maintenance_tickets(title), contractor:profiles!payments_contractor_id_fkey(full_name)`)
      .eq('id', req.params.id)
      .single();

    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Payment is not pending authorization' });
    }

    await supabase
      .from('payments')
      .update({
        status: 'authorized',
        authorized_by: req.user.id,
        authorized_at: new Date(),
        notes,
        updated_at: new Date(),
      })
      .eq('id', req.params.id);

    // Update ticket to paid
    await supabase
      .from('maintenance_tickets')
      .update({ status: 'paid', updated_at: new Date() })
      .eq('id', payment.ticket_id);

    await logAudit({
      userId: req.user.id,
      action: 'payment_authorized',
      entityType: 'payment',
      entityId: req.params.id,
      meta: { amount: payment.amount },
    });

    await createNotification({
      userId: payment.contractor_id,
      title: 'Payment Authorized',
      message: `Payment of £${Number(payment.amount).toFixed(2)} for "${payment.ticket?.title}" has been authorized`,
      type: 'payment_authorized',
      entityType: 'payment',
      entityId: req.params.id,
    });

    res.json({ message: 'Payment authorized', status: 'authorized' });
  }
);

// Mark as paid
router.post('/:id/paid',
  authenticate,
  requireRole('property_owner', 'admin', 'property_manager'),
  async (req, res) => {
    const { transaction_ref, paid_at } = req.body;

    const { data: payment } = await supabase
      .from('payments')
      .select('*, contractor_id, ticket:maintenance_tickets(title)')
      .eq('id', req.params.id)
      .single();

    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'authorized') {
      return res.status(400).json({ error: 'Payment must be authorized first' });
    }

    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        transaction_ref,
        paid_at: paid_at || new Date(),
        updated_at: new Date(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    await createNotification({
      userId: payment.contractor_id,
      title: 'Payment Sent',
      message: `Your payment of £${Number(payment.amount).toFixed(2)} has been sent`,
      type: 'payment_sent',
      entityType: 'payment',
      entityId: req.params.id,
    });

    await logAudit({
      userId: req.user.id,
      action: 'payment_paid',
      entityType: 'payment',
      entityId: req.params.id,
      meta: { transaction_ref },
    });

    res.json({ payment: data });
  }
);

export default router;
