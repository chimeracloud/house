import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { createNotification, notifyRole } from '../utils/notifications.js';

const router = Router();

const VALID_STATUSES = [
  'pending', 'awaiting_quote', 'approved', 'in_progress',
  'awaiting_inspection', 'completed', 'rejected', 'paid',
];

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// List tickets with filters
router.get('/', authenticate, async (req, res) => {
  const { status, priority, assigned_to, room_id, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let q = supabase
    .from('maintenance_tickets')
    .select(`
      *,
      room:rooms(name, number),
      created_by_profile:profiles!maintenance_tickets_created_by_fkey(full_name, role),
      assigned_contractor:profiles!maintenance_tickets_assigned_contractor_fkey(full_name, company_name),
      attachments:ticket_attachments(id, file_url, file_type, label),
      quotations(id, status, total_amount, contractor_id)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  // Contractors only see their assigned/quoted tickets
  if (req.user.profile?.role === 'contractor') {
    q = q.or(`assigned_contractor.eq.${req.user.id},created_by.eq.${req.user.id}`);
  }

  if (status) q = q.eq('status', status);
  if (priority) q = q.eq('priority', priority);
  if (assigned_to) q = q.eq('assigned_contractor', assigned_to);
  if (room_id) q = q.eq('room_id', room_id);

  const { data, error, count } = await q;
  if (error) return res.status(400).json({ error: error.message });

  res.json({ tickets: data, total: count, page: Number(page), limit: Number(limit) });
});

// Get single ticket
router.get('/:id', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .select(`
      *,
      room:rooms(name, number, floor),
      created_by_profile:profiles!maintenance_tickets_created_by_fkey(id, full_name, role, phone),
      assigned_contractor:profiles!maintenance_tickets_assigned_contractor_fkey(id, full_name, company_name, phone),
      attachments:ticket_attachments(*),
      quotations(
        *,
        contractor:profiles!quotations_contractor_id_fkey(id, full_name, company_name, phone),
        items:quote_items(*)
      ),
      approvals(*),
      comments:ticket_comments(
        *,
        author:profiles!ticket_comments_author_id_fkey(full_name, role)
      )
    `)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ ticket: data });
});

// Create ticket
router.post('/',
  authenticate,
  requireRole('property_manager', 'property_owner', 'admin', 'resident'),
  body('title').notEmpty().trim(),
  body('description').notEmpty(),
  body('priority').isIn(VALID_PRIORITIES),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      title, description, priority, room_id,
      deadline, category, estimated_cost,
    } = req.body;

    const { data, error } = await supabase
      .from('maintenance_tickets')
      .insert({
        title,
        description,
        priority,
        room_id,
        deadline,
        category,
        estimated_cost,
        status: 'pending',
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    await logAudit({
      userId: req.user.id,
      action: 'ticket_created',
      entityType: 'ticket',
      entityId: data.id,
      meta: { title, priority },
    });

    await notifyRole('property_manager', {
      title: 'New Maintenance Ticket',
      message: `"${title}" has been logged with ${priority} priority`,
      type: 'ticket_created',
      entityType: 'ticket',
      entityId: data.id,
    });

    res.status(201).json({ ticket: data });
  }
);

// Update ticket
router.patch('/:id',
  authenticate,
  requireRole('property_manager', 'property_owner', 'admin'),
  async (req, res) => {
    const allowed = ['title', 'description', 'priority', 'status', 'room_id',
      'assigned_contractor', 'deadline', 'category', 'estimated_cost'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    updates.updated_at = new Date();

    const { data, error } = await supabase
      .from('maintenance_tickets')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    await logAudit({
      userId: req.user.id,
      action: 'ticket_updated',
      entityType: 'ticket',
      entityId: req.params.id,
      meta: updates,
    });

    res.json({ ticket: data });
  }
);

// Add comment
router.post('/:id/comments', authenticate, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comment content required' });

  const { data, error } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: req.params.id,
      author_id: req.user.id,
      content: content.trim(),
    })
    .select(`*, author:profiles!ticket_comments_author_id_fkey(full_name, role)`)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ comment: data });
});

// Upload attachment (returns signed upload URL)
router.post('/:id/attachments', authenticate, async (req, res) => {
  const { file_name, file_type, label, mime_type } = req.body;
  if (!file_name || !file_type) {
    return res.status(400).json({ error: 'file_name and file_type required' });
  }

  const path = `tickets/${req.params.id}/${Date.now()}_${file_name}`;

  const { data: signedData, error: signedError } = await supabase.storage
    .from('attachments')
    .createSignedUploadUrl(path);

  if (signedError) return res.status(400).json({ error: signedError.message });

  const publicUrl = supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl;

  const { data, error } = await supabase
    .from('ticket_attachments')
    .insert({
      ticket_id: req.params.id,
      uploaded_by: req.user.id,
      file_name,
      file_url: publicUrl,
      file_path: path,
      file_type,
      label,
      mime_type,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.status(201).json({
    attachment: data,
    upload_url: signedData.signedUrl,
    token: signedData.token,
  });
});

// Inspect / sign-off ticket
router.post('/:id/signoff',
  authenticate,
  requireRole('property_manager', 'property_owner', 'admin'),
  async (req, res) => {
    const { notes, passed } = req.body;

    const { data: ticket } = await supabase
      .from('maintenance_tickets')
      .select('id, title, assigned_contractor, status')
      .eq('id', req.params.id)
      .single();

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status !== 'awaiting_inspection') {
      return res.status(400).json({ error: 'Ticket is not awaiting inspection' });
    }

    const newStatus = passed ? 'completed' : 'in_progress';

    await supabase
      .from('maintenance_tickets')
      .update({ status: newStatus, updated_at: new Date() })
      .eq('id', req.params.id);

    await supabase.from('approvals').insert({
      ticket_id: req.params.id,
      approver_id: req.user.id,
      type: 'inspection',
      decision: passed ? 'approved' : 'rejected',
      notes,
    });

    await logAudit({
      userId: req.user.id,
      action: passed ? 'inspection_passed' : 'inspection_failed',
      entityType: 'ticket',
      entityId: req.params.id,
      meta: { notes, passed },
    });

    if (ticket.assigned_contractor) {
      await createNotification({
        userId: ticket.assigned_contractor,
        title: passed ? 'Work Signed Off' : 'Re-work Required',
        message: passed
          ? `Your work on "${ticket.title}" has been approved`
          : `"${ticket.title}" requires additional work`,
        type: passed ? 'inspection_passed' : 'inspection_failed',
        entityType: 'ticket',
        entityId: req.params.id,
      });
    }

    res.json({ status: newStatus, message: passed ? 'Signed off successfully' : 'Returned to in progress' });
  }
);

export default router;
