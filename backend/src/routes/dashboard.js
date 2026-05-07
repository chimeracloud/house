import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authenticate, async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [ticketsRes, paymentsRes, contractorsRes, pendingApprovalsRes] = await Promise.all([
    supabase.from('maintenance_tickets').select('id, status, priority, created_at, deadline'),
    supabase.from('payments').select('id, amount, status, created_at').gte('created_at', thirtyDaysAgo.toISOString()),
    supabase.from('profiles').select('id').eq('role', 'contractor'),
    supabase.from('quotations').select('id').in('status', ['submitted', 'pending_owner_approval']),
  ]);

  const tickets = ticketsRes.data || [];
  const payments = paymentsRes.data || [];

  const statusCounts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const priorityCounts = tickets.reduce((acc, t) => {
    acc[t.priority] = (acc[t.priority] || 0) + 1;
    return acc;
  }, {});

  const overdue = tickets.filter((t) => {
    if (!t.deadline) return false;
    return new Date(t.deadline) < now && !['completed', 'paid', 'rejected'].includes(t.status);
  });

  const monthlySpend = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingPayments = payments
    .filter((p) => p.status === 'authorized')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  res.json({
    tickets: {
      total: tickets.length,
      by_status: statusCounts,
      by_priority: priorityCounts,
      overdue: overdue.length,
      active: tickets.filter((t) => !['completed', 'paid', 'rejected'].includes(t.status)).length,
    },
    finances: {
      monthly_spend: monthlySpend,
      pending_payments: pendingPayments,
      total_invoiced_30d: payments.reduce((s, p) => s + Number(p.amount), 0),
    },
    contractors: {
      total: contractorsRes.data?.length || 0,
    },
    approvals: {
      pending: pendingApprovalsRes.data?.length || 0,
    },
  });
});

// Recent activity feed
router.get('/activity', authenticate, async (req, res) => {
  const { limit = 20 } = req.query;

  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      user:profiles!audit_logs_user_id_fkey(full_name, role)
    `)
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  if (error) return res.status(400).json({ error: error.message });
  res.json({ activity: data });
});

// Monthly cost breakdown
router.get('/costs', authenticate, async (req, res) => {
  const { months = 6 } = req.query;
  const since = new Date();
  since.setMonth(since.getMonth() - Number(months));

  const { data, error } = await supabase
    .from('payments')
    .select('amount, created_at, status')
    .gte('created_at', since.toISOString())
    .eq('status', 'paid');

  if (error) return res.status(400).json({ error: error.message });

  const monthly = {};
  for (const p of data || []) {
    const month = p.created_at.substring(0, 7); // YYYY-MM
    monthly[month] = (monthly[month] || 0) + Number(p.amount);
  }

  const result = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));

  res.json({ costs: result });
});

// Notifications
router.get('/notifications', authenticate, async (req, res) => {
  const { unread_only = false, limit = 30 } = req.query;

  let q = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  if (unread_only === 'true') q = q.eq('read', false);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });

  const unreadCount = (data || []).filter((n) => !n.read).length;
  res.json({ notifications: data, unread_count: unreadCount });
});

// Mark notification read
router.patch('/notifications/:id/read', authenticate, async (req, res) => {
  await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date() })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  res.json({ message: 'Marked as read' });
});

// Mark all read
router.post('/notifications/read-all', authenticate, async (req, res) => {
  await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date() })
    .eq('user_id', req.user.id)
    .eq('read', false);

  res.json({ message: 'All notifications marked as read' });
});

// Rooms list
router.get('/rooms', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('rooms')
    .select(`*, tickets:maintenance_tickets(id, status)`)
    .order('number');

  if (error) return res.status(400).json({ error: error.message });
  res.json({ rooms: data });
});

export default router;
