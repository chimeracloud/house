import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { Cog6ToothIcon, UserIcon, UsersIcon } from '@heroicons/react/24/outline';

function ProfileSection({ profile }) {
  const { updateProfile } = useAuthStore();
  const { register, handleSubmit } = useForm({ defaultValues: profile });

  const { mutate: save, isPending } = useMutation({
    mutationFn: async (values) => {
      const { data } = await api.patch('/auth/me', values);
      return data.profile;
    },
    onSuccess: (p) => { updateProfile(p); toast.success('Profile updated'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Update failed'),
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
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await api.get('/auth/admin/users');
      return data.users;
    },
  });

  const { mutate: createUser, isPending } = useMutation({
    mutationFn: async (values) => api.post('/auth/admin/users', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User created');
      reset();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create user'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Create User Account</h3>
        <form onSubmit={handleSubmit(createUser)} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" {...register('full_name', { required: true })} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" {...register('email', { required: true })} />
            </div>
            <div>
              <label className="label">Role *</label>
              <select className="input" {...register('role', { required: true })}>
                <option value="">Select role</option>
                <option value="property_manager">Property Manager</option>
                <option value="property_owner">Property Owner</option>
                <option value="contractor">Contractor</option>
                <option value="resident">Resident</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" className="input" {...register('phone')} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="btn-primary text-sm">
              {isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">All Users</h3>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs hidden sm:table-cell">Role</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400 text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {(users || []).map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-xs text-slate-900 dark:text-white">{u.full_name}</p>
                    {u.company_name && <p className="text-xs text-slate-400">{u.company_name}</p>}
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-slate-500 capitalize">
                    {u.role?.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs text-slate-500">{u.phone || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`badge text-xs ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
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
  const { user, isAdmin, isOwner, isStaff } = useAuthStore();

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

      {(isAdmin || isOwner || isStaff) && (
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
