import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserIcon, UsersIcon, HomeModernIcon, WrenchScrewdriverIcon,
  BuildingOffice2Icon, BriefcaseIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { profiles, roomsApi } from '../lib/data';
import { useAuthStore } from '../stores/authStore';
import RoleManager from '../components/settings/RoleManager';
import RoomsManager from '../components/settings/RoomsManager';

const TABS = [
  { key: 'profile',     label: 'My Profile',  icon: UserIcon,             role: null },
  { key: 'tenants',     label: 'Tenants',     icon: UsersIcon,            role: 'staff', userRole: 'tenant' },
  { key: 'rooms',       label: 'Rooms',       icon: HomeModernIcon,       role: 'staff', component: 'rooms' },
  { key: 'contractors', label: 'Contractors', icon: WrenchScrewdriverIcon, role: 'staff', userRole: 'contractor' },
  { key: 'owners',      label: 'Owners',      icon: BuildingOffice2Icon,  role: 'staff', userRole: 'property_owner' },
  { key: 'managers',    label: 'Managers',    icon: BriefcaseIcon,        role: 'staff', userRole: 'property_manager' },
  { key: 'roles',       label: 'All Users & Roles', icon: ShieldCheckIcon, role: 'staff' },
];

function ProfileSection() {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const { register, handleSubmit } = useForm({ defaultValues: profile || {} });

  const { mutate: save, isPending } = useMutation({
    mutationFn: (values) => updateProfile(values),
    onSuccess: () => toast.success('Profile updated'),
    onError: (e) => toast.error(e.message || 'Update failed'),
  });

  if (!profile) return null;

  return (
    <form onSubmit={handleSubmit(save)} className="space-y-4 max-w-2xl">
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
      <div className="text-xs text-slate-500">
        Role: <span className="font-medium text-slate-900 dark:text-white capitalize">{profile.role?.replace('_', ' ')}</span>
        {' · '}
        Status: <span className={clsx('font-medium', profile.is_active ? 'text-emerald-600' : 'text-amber-600')}>
          {profile.is_active ? 'Active' : profile.approval_status || 'Inactive'}
        </span>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function PeopleByRole({ role, label, emptyText }) {
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ['profiles-by-role', role],
    queryFn: () => profiles.listByRole(role),
  });

  const { mutate: setActive } = useMutation({
    mutationFn: ({ id, is_active }) => profiles.setActive(id, is_active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles-by-role', role] });
      toast.success('Status updated');
    },
    onError: (e) => toast.error(e.message || 'Failed'),
  });

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!users?.length) return <p className="text-sm text-slate-400">{emptyText || `No ${label.toLowerCase()} yet.`}</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {users.length} {users.length === 1 ? label.replace(/s$/, '') : label}. Click any row to expand.
      </p>
      <div className="card overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
        {users.map((u) => (
          <PersonRow key={u.id} user={u} onToggleActive={(v) => setActive({ id: u.id, is_active: v })} />
        ))}
      </div>
    </div>
  );
}

function PersonRow({ user, onToggleActive }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-sm flex-shrink-0">
            {user.full_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {user.full_name || user.email || user.id}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {user.id_number || '—'}{user.company_name ? ` · ${user.company_name}` : ''}{user.phone ? ` · ${user.phone}` : ''}
          </p>
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); onToggleActive(!user.is_active); }}
          className={clsx(
            'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full cursor-pointer',
            user.is_active
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-200 text-slate-500 dark:bg-slate-700'
          )}
        >
          {user.is_active ? 'Active' : (user.approval_status || 'Inactive')}
        </span>
      </button>

      {expanded && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <Field label="Email" value={user.email} />
            <Field label="Phone" value={user.phone} />
            <Field label="ID Number" value={user.id_number} />
            <Field label="Company" value={user.company_name} />
            <Field label="Services" value={user.services} />
            <Field label="Marital Status" value={user.marital_status} />
            <Field label="Monthly Income" value={user.monthly_nett_income ? `R ${Number(user.monthly_nett_income).toFixed(2)}` : null} />
            <Field label="Work Address" value={user.work_address} />
            <Field label="Next of Kin" value={user.next_of_kin_name && `${user.next_of_kin_name}${user.next_of_kin_phone ? ` · ${user.next_of_kin_phone}` : ''}`} />
            <Field label="Medical" value={user.medical_conditions} />
            <Field label="Previous Address" value={user.previous_address} />
            <Field label="Credit Check Score" value={user.credit_score ?? null} />
          </dl>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="text-xs text-slate-700 dark:text-slate-200 break-words">{value}</dd>
    </div>
  );
}

export default function Settings() {
  const isStaff = useAuthStore((s) => s.isStaff);
  const [tab, setTab] = useState('profile');

  const visibleTabs = TABS.filter((t) => !t.role || (t.role === 'staff' && isStaff));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500">Manage profile, rooms, tenants, contractors and roles</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.key
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div>
        {tab === 'profile' && (
          <div className="card p-5">
            <ProfileSection />
          </div>
        )}
        {tab === 'tenants' && (
          <div className="card p-5">
            <PeopleByRole role="tenant" label="Tenants" emptyText="No tenants registered yet — they appear here after admin approval." />
          </div>
        )}
        {tab === 'rooms' && (
          <div className="card p-5">
            <RoomsManager />
          </div>
        )}
        {tab === 'contractors' && (
          <div className="card p-5">
            <PeopleByRole role="contractor" label="Contractors" emptyText="No contractors registered yet." />
          </div>
        )}
        {tab === 'owners' && (
          <div className="card p-5">
            <PeopleByRole role="property_owner" label="Owners" emptyText="No property owners set yet — promote a registered user under 'All Users & Roles'." />
          </div>
        )}
        {tab === 'managers' && (
          <div className="card p-5">
            <PeopleByRole role="property_manager" label="Managers" emptyText="No property managers yet." />
          </div>
        )}
        {tab === 'roles' && (
          <div className="card p-5">
            <RoleManager />
          </div>
        )}
      </div>
    </div>
  );
}
