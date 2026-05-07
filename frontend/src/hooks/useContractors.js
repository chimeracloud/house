import { useQuery } from '@tanstack/react-query';
import { contractors } from '../lib/data';
import { useAuthStore } from '../stores/authStore';

export function useContractors() {
  const uid = useAuthStore((s) => s.firebaseUser?.uid);
  return useQuery({
    queryKey: ['contractors'],
    queryFn: () => contractors.list(),
    enabled: !!uid,
  });
}

export function useContractor(id) {
  return useQuery({
    queryKey: ['contractor', id],
    queryFn: () => contractors.get(id),
    enabled: !!id,
  });
}
