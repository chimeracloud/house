import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { supabase, supabaseAnon } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Register (contractor self-registration or admin invitation)
router.post('/register',
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').notEmpty(),
  body('role').isIn(['contractor', 'resident']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, full_name, role, phone, company_name } = req.body;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (error) return res.status(400).json({ error: error.message });

    await supabase.from('profiles').insert({
      id: data.user.id,
      full_name,
      role,
      phone,
      company_name,
    });

    res.status(201).json({ message: 'Account created successfully', user_id: data.user.id });
  }
);

// Login
router.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) return res.status(401).json({ error: 'Invalid credentials' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { ...data.user, profile },
    });
  }
);

// Refresh token
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token });
  if (error) return res.status(401).json({ error: 'Invalid refresh token' });

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// Update profile
router.patch('/me', authenticate, async (req, res) => {
  const { full_name, phone, company_name, avatar_url } = req.body;

  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name, phone, company_name, avatar_url, updated_at: new Date() })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ profile: data });
});

// Admin: create staff users
router.post('/admin/users',
  authenticate,
  body('email').isEmail(),
  body('full_name').notEmpty(),
  body('role').isIn(['property_manager', 'property_owner', 'contractor', 'resident', 'admin']),
  async (req, res) => {
    if (!['admin', 'property_owner'].includes(req.user.profile?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, full_name, role, phone, company_name, password } = req.body;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: password || Math.random().toString(36).slice(-10) + 'A1!',
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (error) return res.status(400).json({ error: error.message });

    await supabase.from('profiles').insert({
      id: data.user.id,
      full_name,
      role,
      phone,
      company_name,
    });

    res.status(201).json({ message: 'User created', user_id: data.user.id });
  }
);

// List all users (admin/manager/owner)
router.get('/admin/users', authenticate, async (req, res) => {
  const role = req.user.profile?.role;
  if (!['admin', 'property_owner', 'property_manager'].includes(role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ users: data });
});

export default router;
