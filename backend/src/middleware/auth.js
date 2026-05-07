import { auth, db } from '../lib/firebase.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await auth.verifyIdToken(token);
    const profileSnap = await db.collection('profiles').doc(decoded.uid).get();
    const profile = profileSnap.exists ? profileSnap.data() : null;
    req.user = { uid: decoded.uid, email: decoded.email, profile };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.profile?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
