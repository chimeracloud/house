import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { auth, db, FieldValue } from '../lib/firebase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get current user profile
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Update profile
router.patch('/me', authenticate, async (req, res) => {
  const { full_name, phone, company_name, avatar_url } = req.body;
  const updates = { updated_at: FieldValue.serverTimestamp() };
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;
  if (company_name !== undefined) updates.company_name = company_name;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  await db.collection('profiles').doc(req.user.uid).update(updates);
  const snap = await db.collection('profiles').doc(req.user.uid).get();
  res.json({ profile: { id: snap.id, ...snap.data() } });
});

// Admin: create user
router.post('/admin/users',
  authenticate,
  body('email').isEmail(),
  body('full_name').notEmpty(),
  body('role').isIn(['property_manager', 'property_owner', 'contractor', 'resident', 'admin']),
  async (req, res) => {
    if (!['admin', 'property_owner', 'property_manager'].includes(req.user.profile?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, full_name, role, phone, company_name, password } = req.body;

    try {
      const userRecord = await auth.createUser({
        email,
        password: password || `Temp${Math.random().toString(36).slice(-8)}A1!`,
        displayName: full_name,
      });

      await db.collection('profiles').doc(userRecord.uid).set({
        full_name, role, phone: phone || null,
        company_name: company_name || null,
        is_active: true,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      res.status(201).json({ message: 'User created', user_id: userRecord.uid });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// List all users (staff only)
router.get('/admin/users', authenticate, async (req, res) => {
  if (!['admin', 'property_owner', 'property_manager'].includes(req.user.profile?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  const snap = await db.collection('profiles').orderBy('created_at', 'desc').get();
  const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  res.json({ users });
});

export default router;
