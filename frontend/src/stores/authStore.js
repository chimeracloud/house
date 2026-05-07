import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,

      setAuth: (user, token, refreshToken) =>
        set({ user, token, refreshToken }),

      setTokens: (token, refreshToken) =>
        set({ token, refreshToken }),

      updateProfile: (profile) =>
        set((state) => ({ user: { ...state.user, profile } })),

      logout: () => {
        set({ user: null, token: null, refreshToken: null });
        window.location.href = '/login';
      },

      get role() {
        return get().user?.profile?.role;
      },

      get isOwner() {
        return get().user?.profile?.role === 'property_owner';
      },

      get isManager() {
        return get().user?.profile?.role === 'property_manager';
      },

      get isContractor() {
        return get().user?.profile?.role === 'contractor';
      },

      get isAdmin() {
        return get().user?.profile?.role === 'admin';
      },

      get isStaff() {
        const r = get().user?.profile?.role;
        return ['property_manager', 'property_owner', 'admin'].includes(r);
      },
    }),
    {
      name: 'house-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
