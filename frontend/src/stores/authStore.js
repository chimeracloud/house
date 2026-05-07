import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, db } from '../lib/firebase';

const buildUser = (fbUser, profile) => {
  if (!fbUser) return null;
  return { uid: fbUser.uid, email: fbUser.email, profile };
};

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
        });
        return;
      }

      let profile = null;
      try {
        const ref = doc(db, 'profiles', fbUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          profile = { id: snap.id, ...snap.data() };
        } else {
          // First sign-in: bootstrap a default profile. Role is 'resident'; staff promote later.
          const seed = {
            full_name: fbUser.displayName || fbUser.email?.split('@')[0] || '',
            role: 'resident',
            is_active: true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          };
          await setDoc(ref, seed);
          const after = await getDoc(ref);
          profile = after.exists() ? { id: after.id, ...after.data() } : null;
        }
      } catch (err) {
        console.warn('[auth] Failed to load/create profile:', err.message);
      }

      const role = profile?.role || null;
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
        isStaff: ['property_manager', 'property_owner', 'admin'].includes(role),
      });
    });
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
    set({
      profile,
      user: buildUser(fbUser, profile),
      role,
      isOwner: role === 'property_owner',
      isManager: role === 'property_manager',
      isContractor: role === 'contractor',
      isAdmin: role === 'admin',
      isStaff: ['property_manager', 'property_owner', 'admin'].includes(role),
    });
    return profile;
  },

  getIdToken: async () => {
    const fbUser = get().firebaseUser;
    if (!fbUser) return null;
    return fbUser.getIdToken();
  },
}));
