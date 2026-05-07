import { Router } from 'express';
import { db, FieldValue } from '../lib/firebase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authenticate, async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [ticketsSnap, paymentsSnap, contractorsSnap, pendingQuotesSnap] = await Promise.all([
    db.collection('tickets').get(),
    db.collection('payments').where('created_at', '>=', thirtyDaysAgo).get(),
    db.collection('profiles').where('role', '==', 'contractor').get(),
    db.collection('quotations').where('status', 'in', ['submitted', 'pending_owner_approval']).get(),
  ]);

  const tickets = ticketsSnap.docs.map((d) => d.data());
  const payments = paymentsSnap.docs.map((d) => d.data());

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
      total: contractorsSnap.size,
    },
    approvals: {
      pending: pendingQuotesSnap.size,
    },
  });
});

router.get('/activity', authenticate, async (req, res) => {
  const { limit = 20 } = req.query;

  const snap = await db.collection('audit_logs')
    .orderBy('created_at', 'desc')
    .limit(Number(limit))
    .get();

  const activity = await Promise.all(snap.docs.map(async (d) => {
    const log = { id: d.id, ...d.data() };
    const profileSnap = await db.collection('profiles').doc(log.user_id).get();
    if (profileSnap.exists) {
      const p = profileSnap.data();
      log.user = { full_name: p.full_name, role: p.role };
    }
    return log;
  }));

  res.json({ activity });
});

router.get('/costs', authenticate, async (req, res) => {
  const { months = 6 } = req.query;
  const since = new Date();
  since.setMonth(since.getMonth() - Number(months));

  const snap = await db.collection('payments')
    .where('status', '==', 'paid')
    .where('created_at', '>=', since)
    .get();

  const monthly = {};
  for (const d of snap.docs) {
    const data = d.data();
    const ts = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at);
    const month = ts.toISOString().substring(0, 7);
    monthly[month] = (monthly[month] || 0) + Number(data.amount);
  }

  const costs = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));

  res.json({ costs });
});

router.get('/notifications', authenticate, async (req, res) => {
  const { unread_only = false, limit = 30 } = req.query;

  let q = db.collection('notifications')
    .where('user_id', '==', req.user.uid)
    .orderBy('created_at', 'desc')
    .limit(Number(limit));

  if (unread_only === 'true') q = q.where('read', '==', false);

  const snap = await q.get();
  const notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const unread_count = notifications.filter((n) => !n.read).length;

  res.json({ notifications, unread_count });
});

router.patch('/notifications/:id/read', authenticate, async (req, res) => {
  await db.collection('notifications').doc(req.params.id).update({
    read: true,
    read_at: FieldValue.serverTimestamp(),
  });
  res.json({ message: 'Marked as read' });
});

router.post('/notifications/read-all', authenticate, async (req, res) => {
  const snap = await db.collection('notifications')
    .where('user_id', '==', req.user.uid)
    .where('read', '==', false)
    .get();

  const batch = db.batch();
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true, read_at: FieldValue.serverTimestamp() });
  });
  await batch.commit();

  res.json({ message: 'All notifications marked as read' });
});

router.get('/rooms', authenticate, async (req, res) => {
  const [roomsSnap, ticketsSnap] = await Promise.all([
    db.collection('rooms').orderBy('number').get(),
    db.collection('tickets').get(),
  ]);

  const ticketsByRoom = {};
  ticketsSnap.docs.forEach((d) => {
    const t = d.data();
    if (t.room_id) {
      if (!ticketsByRoom[t.room_id]) ticketsByRoom[t.room_id] = [];
      ticketsByRoom[t.room_id].push({ id: d.id, status: t.status });
    }
  });

  const rooms = roomsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    tickets: ticketsByRoom[d.id] || [],
  }));

  res.json({ rooms });
});

export default router;
