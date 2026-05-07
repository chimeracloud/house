import { Router } from 'express';
import { db, FieldValue } from '../lib/firebase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const snap = await db.collection('profiles').where('role', '==', 'contractor').get();

  const contractors = await Promise.all(snap.docs.map(async (doc) => {
    const [ratingsSnap, ticketsSnap] = await Promise.all([
      db.collection('contractor_ratings').where('contractor_id', '==', doc.id).get(),
      db.collection('tickets').where('assigned_contractor', '==', doc.id).get(),
    ]);

    const ratings = ratingsSnap.docs.map((r) => r.data().rating);
    const avgRating = ratings.length ? ratings.reduce((s, v) => s + v, 0) / ratings.length : null;
    const tickets = ticketsSnap.docs.map((t) => t.data());
    const completed = tickets.filter((t) => ['completed', 'paid'].includes(t.status)).length;

    return {
      id: doc.id, ...doc.data(),
      avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      total_jobs: tickets.length,
      completed_jobs: completed,
      completion_rate: tickets.length ? Math.round((completed / tickets.length) * 100) : null,
    };
  }));

  res.json({ contractors });
});

router.get('/:id', authenticate, async (req, res) => {
  const doc = await db.collection('profiles').doc(req.params.id).get();
  if (!doc.exists || doc.data().role !== 'contractor') return res.status(404).json({ error: 'Contractor not found' });

  const [ratingsSnap, quotesSnap, ticketsSnap] = await Promise.all([
    db.collection('contractor_ratings').where('contractor_id', '==', req.params.id).get(),
    db.collection('quotations').where('contractor_id', '==', req.params.id).get(),
    db.collection('tickets').where('assigned_contractor', '==', req.params.id).get(),
  ]);

  res.json({
    contractor: {
      id: doc.id, ...doc.data(),
      ratings: ratingsSnap.docs.map((r) => ({ id: r.id, ...r.data() })),
      quotations: quotesSnap.docs.map((q) => ({ id: q.id, ...q.data() })),
      assigned_tickets: ticketsSnap.docs.map((t) => ({ id: t.id, ...t.data() })),
    },
  });
});

router.post('/:id/rate', authenticate, requireRole('property_manager', 'property_owner', 'admin'), async (req, res) => {
  const { ticket_id, rating, category, comment } = req.body;
  if (!ticket_id || !rating || !category) return res.status(400).json({ error: 'ticket_id, rating and category required' });

  // Upsert: check for existing rating
  const existing = await db.collection('contractor_ratings')
    .where('contractor_id', '==', req.params.id)
    .where('ticket_id', '==', ticket_id)
    .where('category', '==', category)
    .limit(1).get();

  const ratingData = {
    contractor_id: req.params.id, ticket_id,
    rated_by: req.user.uid,
    rating: Number(rating), category,
    comment: comment || null,
    created_at: FieldValue.serverTimestamp(),
  };

  let ref;
  if (!existing.empty) {
    ref = existing.docs[0].ref;
    await ref.update(ratingData);
  } else {
    ref = await db.collection('contractor_ratings').add(ratingData);
  }

  const snap = await ref.get();
  res.status(201).json({ rating: { id: snap.id, ...snap.data() } });
});

router.get('/:id/analytics', authenticate, async (req, res) => {
  const [ratingsSnap, ticketsSnap, quotesSnap] = await Promise.all([
    db.collection('contractor_ratings').where('contractor_id', '==', req.params.id).get(),
    db.collection('tickets').where('assigned_contractor', '==', req.params.id).get(),
    db.collection('quotations').where('contractor_id', '==', req.params.id).get(),
  ]);

  const ratings = ratingsSnap.docs.map((d) => d.data());
  const tickets = ticketsSnap.docs.map((d) => d.data());
  const quotes = quotesSnap.docs.map((d) => d.data());

  const byCategory = {};
  ratings.forEach((r) => {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r.rating);
  });

  const completed = tickets.filter((t) => ['completed', 'paid'].includes(t.status));
  const approvedQuotes = quotes.filter((q) => q.status === 'approved');

  res.json({
    avg_ratings_by_category: Object.fromEntries(
      Object.entries(byCategory).map(([c, vals]) => [c, Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10])
    ),
    overall_avg: ratings.length ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10 : null,
    total_jobs: tickets.length,
    completed_jobs: completed.length,
    completion_rate: tickets.length ? Math.round((completed.length / tickets.length) * 100) : 0,
    total_quotes: quotes.length,
    quotes_won: approvedQuotes.length,
    win_rate: quotes.length ? Math.round((approvedQuotes.length / quotes.length) * 100) : 0,
    total_revenue: approvedQuotes.reduce((s, q) => s + Number(q.total_amount), 0),
  });
});

export default router;
