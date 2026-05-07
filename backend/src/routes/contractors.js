import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../lib/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// List contractors with performance stats
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      ratings:contractor_ratings(rating, category),
      assigned_tickets:maintenance_tickets!maintenance_tickets_assigned_contractor_fkey(
        id, status, created_at, updated_at
      )
    `)
    .eq('role', 'contractor')
    .order('full_name');

  if (error) return res.status(400).json({ error: error.message });

  // Calculate avg rating per contractor
  const contractors = data.map((c) => {
    const ratings = c.ratings || [];
    const avgRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : null;

    const tickets = c.assigned_tickets || [];
    const completedTickets = tickets.filter((t) => ['completed', 'paid'].includes(t.status));
    const completionRate = tickets.length
      ? Math.round((completedTickets.length / tickets.length) * 100)
      : null;

    return {
      ...c,
      avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      total_jobs: tickets.length,
      completed_jobs: completedTickets.length,
      completion_rate: completionRate,
    };
  });

  res.json({ contractors });
});

// Get contractor profile
router.get('/:id', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      ratings:contractor_ratings(
        *,
        ticket:maintenance_tickets(title),
        rated_by:profiles!contractor_ratings_rated_by_fkey(full_name)
      ),
      quotations(id, status, total_amount, created_at, ticket:maintenance_tickets(title)),
      assigned_tickets:maintenance_tickets!maintenance_tickets_assigned_contractor_fkey(
        id, title, status, priority, created_at, updated_at
      )
    `)
    .eq('id', req.params.id)
    .eq('role', 'contractor')
    .single();

  if (error) return res.status(404).json({ error: 'Contractor not found' });
  res.json({ contractor: data });
});

// Rate contractor
router.post('/:id/rate',
  authenticate,
  requireRole('property_manager', 'property_owner', 'admin'),
  body('ticket_id').isUUID(),
  body('rating').isFloat({ min: 1, max: 5 }),
  body('category').isIn(['quality', 'timeliness', 'communication', 'value', 'overall']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { ticket_id, rating, category, comment } = req.body;

    // Check ticket is completed
    const { data: ticket } = await supabase
      .from('maintenance_tickets')
      .select('id, assigned_contractor, status')
      .eq('id', ticket_id)
      .single();

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!['completed', 'paid'].includes(ticket.status)) {
      return res.status(400).json({ error: 'Can only rate completed work' });
    }
    if (ticket.assigned_contractor !== req.params.id) {
      return res.status(400).json({ error: 'Contractor was not assigned to this ticket' });
    }

    const { data, error } = await supabase
      .from('contractor_ratings')
      .upsert({
        contractor_id: req.params.id,
        ticket_id,
        rated_by: req.user.id,
        rating: Number(rating),
        category,
        comment,
      }, { onConflict: 'contractor_id,ticket_id,category' })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ rating: data });
  }
);

// Contractor performance analytics
router.get('/:id/analytics', authenticate, async (req, res) => {
  const [ratingsRes, ticketsRes, quotesRes] = await Promise.all([
    supabase
      .from('contractor_ratings')
      .select('rating, category, created_at')
      .eq('contractor_id', req.params.id),
    supabase
      .from('maintenance_tickets')
      .select('id, status, created_at, updated_at, priority')
      .eq('assigned_contractor', req.params.id),
    supabase
      .from('quotations')
      .select('id, status, total_amount, created_at')
      .eq('contractor_id', req.params.id),
  ]);

  const ratings = ratingsRes.data || [];
  const tickets = ticketsRes.data || [];
  const quotes = quotesRes.data || [];

  const ratingsByCategory = {};
  for (const r of ratings) {
    if (!ratingsByCategory[r.category]) ratingsByCategory[r.category] = [];
    ratingsByCategory[r.category].push(r.rating);
  }
  const avgByCategory = Object.fromEntries(
    Object.entries(ratingsByCategory).map(([cat, vals]) => [
      cat,
      Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
    ])
  );

  const completedTickets = tickets.filter((t) => ['completed', 'paid'].includes(t.status));
  const totalRevenue = quotes
    .filter((q) => q.status === 'approved')
    .reduce((sum, q) => sum + Number(q.total_amount), 0);

  res.json({
    avg_ratings_by_category: avgByCategory,
    overall_avg: ratings.length
      ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
      : null,
    total_jobs: tickets.length,
    completed_jobs: completedTickets.length,
    pending_jobs: tickets.filter((t) => t.status === 'in_progress').length,
    completion_rate: tickets.length
      ? Math.round((completedTickets.length / tickets.length) * 100)
      : 0,
    total_quotes_submitted: quotes.length,
    quotes_won: quotes.filter((q) => q.status === 'approved').length,
    win_rate: quotes.length
      ? Math.round((quotes.filter((q) => q.status === 'approved').length / quotes.length) * 100)
      : 0,
    total_revenue: totalRevenue,
  });
});

export default router;
