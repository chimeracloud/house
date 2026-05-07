import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { profiles } from '../lib/data';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { UserIcon, UsersIcon } from '@heroicons/react/24/outline';

const ROLES = ['property_manager', 'property_owner', 'contractor', 'resident', 'admin'];

function ProfileSection({ profile }) {
  const { updateProfile } = useAuthStore();
  const { register, handleSubmit } = useForm({ defaultValues: profile });

  const { mutate: save, isPending } = useMutation({
    mutationFn: (values) => updateProfile(values),
    onSuccess: () => toast.success('Profile updated'),
    onError: (e) => toast.error(e.message || 'Update failed'),
  });

  return (
    <form onSubmit={handleSubmit(save)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Full Name</label>
          <input className="input" {...register('full_name')} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" type="tel" {...register('phone')} />
        </div>
      </div>
      <div>
        <label className="label">Company Name</label>
        <input className="input" {...register('company_name')} />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function UserManagement() {
  const qc = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => profiles.list(),
  });

  const { mutate: setRole, isPending } = useMutation({
    mutationFn: async ({ id, role }) => {
      await updateDoc(doc(db, 'profiles', id), { role, updated_at: serverTimestamp() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Role updated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update role'),
  });

  const { mutate: setActive } = useMutation({
    mutationFn: async ({ id, is_active }) => {
      await updateDoc(doc(db, 'profiles', id), { is_active, updated_at: serverTimestamp() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Status updated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update status'),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-xs text-amber-800 dark:text-amber-300">
        <strong>Adding new users:</strong> create their account in <a className="underline" href="https://console.firebase.google.com" target="_blank" rel="noreferrer">Firebase Console → Authentication</a>. After they sign in once, their profile appears below — set the role here.
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">All Users</h3>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs">Role</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {(users || []).map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-xs text-slate-900 dark:text-white">{u.full_name || u.email || u.id}</p>
                    {u.company_name && <p className="text-xs text-slate-400">{u.company_name}</p>}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs text-slate-500">{u.phone || '—'}</td>
                  <td className="px-4 py-2.5">
                    <select
                      className="input py-1 text-xs"
                      defaultValue={u.role || ''}
                      disabled={isPending}
                      onChange={(e) => setRole({ id: u.id, role: e.target.value })}
                    >
                      <option value="">— pick role —</option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setActive({ id: u.id, is_active: !u.is_active })}
                      className={`badge text-xs cursor-pointer ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const isStaff = useAuthStore((s) => s.isStaff);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account and system settings</p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <UserIcon className="w-4 h-4" /> Profile
        </h2>
        {user?.profile && <ProfileSection profile={user.profile} />}
      </div>

      {isStaff && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <UsersIcon className="w-4 h-4" /> User Management
          </h2>
          <UserManagement />
        </div>
      )}
    </div>
  );
}
