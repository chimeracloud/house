import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { createNotification, notifyRole } from '../utils/notifications.js';

const router = Router();

// List quotations
router.get('/', authenticate, async (req, res) => {
  const { ticket_id, status } = req.query;

  let q = supabase
    .from('quotations')
    .select(`
      *,
      ticket:maintenance_tickets(id, title, priority, status),
      contractor:profiles!quotations_contractor_id_fkey(id, full_name, company_name, phone),
      items:quote_items(*)
    `)
    .order('created_at', { ascending: false });

  if (req.user.profile?.role === 'contractor') {
    q = q.eq('contractor_id', req.user.id);
  }

  if (ticket_id) q = q.eq('ticket_id', ticket_id);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ quotations: data });
});

// Get single quotation
router.get('/:id', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('quotations')
    .select(`
      *,
      ticket:maintenance_tickets(id, title, description, priority, room_id),
      contractor:profiles!quotations_contractor_id_fkey(id, full_name, company_name, phone, email:id),
      items:quote_items(*),
      attachments:quote_attachments(*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Quotation not found' });
  res.json({ quotation: data });
});

// Submit quotation (contractor)
router.post('/',
  authenticate,
  requireRole('contractor'),
  body('ticket_id').isUUID(),
  body('items').isArray({ min: 1 }),
  body('valid_until').isISO8601(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { ticket_id, items, valid_until, notes, estimated_days } = req.body;

    const { data: ticket } = await supabase
      .from('maintenance_tickets')
      .select('id, title, status')
      .eq('id', ticket_id)
      .single();

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!['pending', 'awaiting_quote'].includes(ticket.status)) {
      return res.status(400).json({ error: 'Ticket is not accepting quotes' });
    }

    const total_amount = items.reduce((sum, item) => {
      return sum + (Number(item.quantity) * Number(item.unit_price));
    }, 0);

    const { data: quote, error } = await supabase
      .from('quotations')
      .insert({
        ticket_id,
        contractor_id: req.user.id,
        total_amount,
        valid_until,
        notes,
        estimated_days,
        status: 'submitted',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Insert line items
    const quoteItems = items.map((item) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      total: Number(item.quantity) * Number(item.unit_price),
      item_type: item.item_type || 'labour',
    }));

    await supabase.from('quote_items').insert(quoteItems);

    // Move ticket to awaiting_quote if still pending
    if (ticket.status === 'pending') {
      await supabase
        .from('maintenance_tickets')
        .update({ status: 'awaiting_quote' })
        .eq('id', ticket_id);
    }

    await logAudit({
      userId: req.user.id,
      action: 'quote_submitted',
      entityType: 'quotation',
      entityId: quote.id,
      meta: { ticket_id, total_amount },
    });

    await notifyRole('property_manager', {
      title: 'New Quote Received',
      message: `A new quotation of £${total_amount.toFixed(2)} submitted for "${ticket.title}"`,
      type: 'quote_submitted',
      entityType: 'quotation',
      entityId: quote.id,
    });

    res.status(201).json({ quotation: quote });
  }
);

// Approve quote (manager/owner)
router.post('/:id/approve',
  authenticate,
  requireRole('property_manager', 'property_owner', 'admin'),
  async (req, res) => {
    const { notes } = req.body;
    const role = req.user.profile?.role;

    const { data: quote } = await supabase
      .from('quotations')
      .select(`*, ticket:maintenance_tickets(id, title, created_by)`)
      .eq('id', req.params.id)
      .single();

    if (!quote) return res.status(404).json({ error: 'Quotation not found' });
    if (quote.status !== 'submitted') {
      return res.status(400).json({ error: 'Quote cannot be approved in its current state' });
    }

    // Manager review → owner approval required if large
    const needsOwnerApproval = quote.total_amount > 500 && role === 'property_manager';
    const newStatus = needsOwnerApproval ? 'pending_owner_approval' : 'approved';

    await supabase
      .from('quotations')
      .update({ status: newStatus, updated_at: new Date() })
      .eq('id', req.params.id);

    if (!needsOwnerApproval) {
      // Reject all other quotes for this ticket
      await supabase
        .from('quotations')
        .update({ status: 'rejected' })
        .eq('ticket_id', quote.ticket_id)
        .neq('id', req.params.id);

      // Assign contractor to ticket and update status
      await supabase
        .from('maintenance_tickets')
        .update({
          status: 'approved',
          assigned_contractor: quote.contractor_id,
          updated_at: new Date(),
        })
        .eq('id', quote.ticket_id);
    }

    await supabase.from('approvals').insert({
      ticket_id: quote.ticket_id,
      approver_id: req.user.id,
      type: 'quote_approval',
      decision: 'approved',
      notes,
      quote_id: req.params.id,
    });

    await logAudit({
      userId: req.user.id,
      action: 'quote_approved',
      entityType: 'quotation',
      entityId: req.params.id,
    });

    await createNotification({
      userId: quote.contractor_id,
      title: needsOwnerApproval ? 'Quote Under Review' : 'Quote Approved!',
      message: needsOwnerApproval
        ? 'Your quote is pending owner approval'
        : `Your quote for "${quote.ticket?.title}" has been approved. You may begin work.`,
      type: 'quote_approved',
      entityType: 'quotation',
      entityId: req.params.id,
    });

    if (needsOwnerApproval) {
      await notifyRole('property_owner', {
        title: 'Quote Approval Required',
        message: `A quote of £${quote.total_amount.toFixed(2)} requires your approval`,
        type: 'quote_pending_owner',
        entityType: 'quotation',
        entityId: req.params.id,
      });
    }

    res.json({ status: newStatus, message: needsOwnerApproval ? 'Sent for owner approval' : 'Quote approved' });
  }
);

// Reject quote
router.post('/:id/reject',
  authenticate,
  requireRole('property_manager', 'property_owner', 'admin'),
  async (req, res) => {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Rejection reason required' });

    const { data: quote } = await supabase
      .from('quotations')
      .select('*, ticket:maintenance_tickets(title)')
      .eq('id', req.params.id)
      .single();

    if (!quote) return res.status(404).json({ error: 'Quotation not found' });

    await supabase
      .from('quotations')
      .update({ status: 'rejected', rejection_reason: reason, updated_at: new Date() })
      .eq('id', req.params.id);

    await supabase.from('approvals').insert({
      ticket_id: quote.ticket_id,
      approver_id: req.user.id,
      type: 'quote_approval',
      decision: 'rejected',
      notes: reason,
      quote_id: req.params.id,
    });

    await createNotification({
      userId: quote.contractor_id,
      title: 'Quote Rejected',
      message: `Your quote for "${quote.ticket?.title}" was rejected: ${reason}`,
      type: 'quote_rejected',
      entityType: 'quotation',
      entityId: req.params.id,
    });

    res.json({ message: 'Quote rejected' });
  }
);

export default router;
