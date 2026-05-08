import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { firebaseAuth, db } from '../lib/firebase';

const buildUser = (fbUser, profile) => {
  if (!fbUser) return null;
  return { uid: fbUser.uid, email: fbUser.email, emailVerified: fbUser.emailVerified, profile };
};

const STAFF_ROLES = ['admin', 'property_owner', 'property_manager'];

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  firebaseUser: null,
  loading: true,
  isAuthenticated: false,
  role: null,

  isOwner: false,
  isManager: false,
  isContractor: false,
  isAdmin: false,
  isStaff: false,

  /**
   * Approval gating — set true once the user's profile has `is_active: true`.
   * New tenants/contractors registering via the public form land with
   * `is_active: false` and approval_status: 'pending' until admin approves.
   * Existing seeded admins / users created via Firebase Console default to
   * is_active = true (no explicit pending flow).
   */
  isApproved: false,
  approvalStatus: null, // 'pending' | 'approved' | 'rejected' | null

  initAuth: () => {
    return onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (!fbUser) {
        set({
          firebaseUser: null,
          profile: null,
          user: null,
          loading: false,
          isAuthenticated: false,
          role: null,
          isOwner: false, isManager: false, isContractor: false, isAdmin: false, isStaff: false,
          isApproved: false,
          approvalStatus: null,
        });
        return;
      }

      let profile = null;
      try {
        const ref = doc(db, 'profiles', fbUser.uid);
        // Use a transaction so the read-then-write is atomic. Without this,
        // sign-in races the Register form's setDoc (both fire from the same
        // onAuthStateChanged event) and either side can clobber the other,
        // sometimes leaving the doc empty if rules transiently reject.
        const seedData = {
          full_name: fbUser.displayName || fbUser.email?.split('@')[0] || '',
          email: fbUser.email || null,
          role: 'resident',
          is_active: false,
          approval_status: 'pending',
          registration_complete: false,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        };
        const txResult = await runTransaction(db, async (tx) => {
          const fresh = await tx.get(ref);
          if (fresh.exists()) {
            return { existed: true, data: fresh.data() };
          }
          // First sign-in WITHOUT a registration form (e.g. user added via
          // Firebase Console). Bootstrap a minimal placeholder profile that
          // requires admin approval before granting access.
          // merge: true keeps any data a concurrent Register form write may
          // already have set safe.
          tx.set(ref, seedData, { merge: true });
          return { existed: false, data: seedData };
        });
        profile = { id: ref.id, ...txResult.data };
      } catch (err) {
        console.warn('[auth] Failed to load/create profile:', err.message);
      }

      const role = profile?.role || null;
      const approvalStatus = profile?.approval_status || (profile?.is_active ? 'approved' : 'pending');
      const isApproved = profile?.is_active === true;

      set({
        firebaseUser: fbUser,
        profile,
        user: buildUser(fbUser, profile),
        loading: false,
        isAuthenticated: true,
        role,
        isOwner: role === 'property_owner',
        isManager: role === 'property_manager',
        isContractor: role === 'contractor',
        isAdmin: role === 'admin',
        isStaff: STAFF_ROLES.includes(role),
        isApproved,
        approvalStatus,
      });
    });
  },

  sendPasswordReset: (email) => sendPasswordResetEmail(firebaseAuth, email),

  sendVerificationEmail: async () => {
    const u = firebaseAuth.currentUser;
    if (!u) throw new Error('Not signed in');
    await sendEmailVerification(u);
  },

  login: async (email, password) => {
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return cred.user;
  },

  logout: async () => {
    await signOut(firebaseAuth);
    window.location.href = '/login';
  },

  updateProfile: async (updates) => {
    const fbUser = get().firebaseUser;
    if (!fbUser) throw new Error('Not signed in');
    const ref = doc(db, 'profiles', fbUser.uid);
    const clean = { updated_at: serverTimestamp() };
    for (const k of ['full_name', 'phone', 'company_name', 'avatar_url']) {
      if (updates[k] !== undefined) clean[k] = updates[k];
    }
    await updateDoc(ref, clean);
    const snap = await getDoc(ref);
    const profile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    set({
      profile,
      user: buildUser(fbUser, profile),
    });
    return profile;
  },

  refreshProfile: async () => {
    const fbUser = get().firebaseUser;
    if (!fbUser) return null;
    const snap = await getDoc(doc(db, 'profiles', fbUser.uid));
    const profile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    const role = profile?.role || null;
    const approvalStatus = profile?.approval_status || (profile?.is_active ? 'approved' : 'pending');
    set({
      profile,
      user: buildUser(fbUser, profile),
      role,
      isOwner: role === 'property_owner',
      isManager: role === 'property_manager',
      isContractor: role === 'contractor',
      isAdmin: role === 'admin',
      isStaff: STAFF_ROLES.includes(role),
      isApproved: profile?.is_active === true,
      approvalStatus,
    });
    return profile;
  },

  getIdToken: async () => {
    const fbUser = get().firebaseUser;
    if (!fbUser) return null;
    return fbUser.getIdToken();
  },
}));
