import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboard } from '../lib/data';
import { useAuthStore } from '../stores/authStore';

export function useDashboardStats() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboard.stats(),
    refetchInterval: 1000 * 60 * 5,
    enabled: !!uid,
  });
}

export function useActivity(lim = 20) {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  return useQuery({
    queryKey: ['activity', lim],
    queryFn: () => dashboard.activity(lim),
    enabled: !!uid,
  });
}

export function useCosts(months = 6) {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  return useQuery({
    queryKey: ['costs', months],
    queryFn: () => dashboard.costs(months),
    enabled: !!uid,
  });
}

export function useNotifications(unreadOnly = false) {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  return useQuery({
    queryKey: ['notifications', unreadOnly, uid],
    queryFn: () => dashboard.notifications({ unreadOnly }),
    refetchInterval: 1000 * 30,
    enabled: !!uid,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => dashboard.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useRooms() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => dashboard.rooms(),
    enabled: !!uid,
  });
}
