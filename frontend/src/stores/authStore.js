import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  firebaseUser: null,
  loading: true,

  initAuth: () => {
    return onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (fbUser) {
        set({ firebaseUser: fbUser, loading: false });
      } else {
        set({ user: null, profile: null, firebaseUser: null, loading: false });
      }
    });
  },

  login: async (email, password) => {
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
    set({ firebaseUser: cred.user });
    return cred.user;
  },

  logout: async () => {
    await signOut(firebaseAuth);
    set({ user: null, profile: null, firebaseUser: null });
    window.location.href = '/login';
  },

  setProfile: (profile) => set({ profile }),

  getIdToken: async () => {
    const fbUser = get().firebaseUser;
    if (!fbUser) return null;
    return fbUser.getIdToken();
  },

  get uid() {
    return get().firebaseUser?.uid;
  },

  get role() {
    return get().profile?.role;
  },

  get isOwner() {
    return get().profile?.role === 'property_owner';
  },

  get isManager() {
    return get().profile?.role === 'property_manager';
  },

  get isContractor() {
    return get().profile?.role === 'contractor';
  },

  get isAdmin() {
    return get().profile?.role === 'admin';
  },

  get isStaff() {
    const r = get().profile?.role;
    return ['property_manager', 'property_owner', 'admin'].includes(r);
  },

  get isAuthenticated() {
    return !!get().firebaseUser;
  },
}));
