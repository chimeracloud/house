import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CheckCircleIcon, XCircleIcon, UserIcon,
  EnvelopeIcon, PhoneIcon, IdentificationIcon, BuildingOfficeIcon,
  ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { profiles } from '../../lib/data';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';

const ROLE_OPTIONS = ['property_manager', 'property_owner', 'contractor', 'tenant', 'resident', 'admin'];

function ApprovalCard({ profile }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [roleOverride, setRoleOverride] = useState(profile.role);

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: () => profiles.approve(profile.id, { role: roleOverride !== profile.role ? roleOverride : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User approved');
    },
    onError: (e) => toast.error(e.message || 'Approval failed'),
  });

  const { mutateAsync: reject, isPending: rejecting } = useMutation({
    mutationFn: () => profiles.reject(profile.id, rejectReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast.success('Registration rejected');
      setRejectOpen(false);
      setRejectReason('');
    },
    onError: (e) => toast.error(e.message || 'Rejection failed'),
  });

  const detail = (label, value) => value ? (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="text-xs text-slate-700 dark:text-slate-200 break-words">{value}</dd>
    </div>
  ) : null;

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0 text-brand-700 dark:text-brand-400 font-bold">
            {profile.full_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{profile.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{profile.email}</p>
            </div>
            <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 capitalize text-[10px]">
              {profile.role?.replace('_', ' ')}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
            {profile.phone && <span className="flex items-center gap-1"><PhoneIcon className="w-3 h-3" />{profile.phone}</span>}
            {profile.id_number && <span className="flex items-center gap-1"><IdentificationIcon className="w-3 h-3" />{profile.id_number}</span>}
            {profile.company_name && <span className="flex items-center gap-1"><BuildingOfficeIcon className="w-3 h-3" />{profile.company_name}</span>}
            {profile.created_at && (
              <span>Submitted {format(new Date(profile.created_at?.toDate ? profile.created_at.toDate() : profile.created_at), 'dd MMM HH:mm')}</span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 -mt-2 border-t border-slate-100 dark:border-slate-700 pt-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            {detail('Role', profile.role?.replace('_', ' '))}
            {detail('ID Number', profile.id_number)}
            {detail('Marital Status', profile.marital_status)}
            {detail('Monthly Income', profile.monthly_nett_income ? `R ${Number(profile.monthly_nett_income).toFixed(2)}` : null)}
            {detail('Work Address', profile.work_address)}
            {detail('Previous Address', profile.previous_address)}
            {detail('Previous Landlord', profile.previous_landlord_name && `${profile.previous_landlord_name}${profile.previous_landlord_phone ? ` · ${profile.previous_landlord_phone}` : ''}${profile.previous_landlord_contact_consent ? ' (may contact)' : ''}`)}
            {detail('Next of Kin', profile.next_of_kin_name && `${profile.next_of_kin_name}${profile.next_of_kin_phone ? ` · ${profile.next_of_kin_phone}` : ''}`)}
            {detail('Medical', profile.medical_conditions)}
            {detail('Company', profile.company_name)}
            {detail('Services', profile.services)}
            {detail('Credit Check Consent', profile.credit_check_consent ? 'Yes' : 'No')}
          </dl>
          {profile.previous_address_comment && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <dt className="text-[10px] uppercase tracking-wider text-slate-400">Previous Address Notes</dt>
              <dd className="text-xs italic text-slate-600 dark:text-slate-300 mt-0.5">{profile.previous_address_comment}</dd>
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-2">
        <button onClick={() => setExpanded((v) => !v)} className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1">
          {expanded ? <><ChevronUpIcon className="w-3 h-3" /> Hide details</> : <><ChevronDownIcon className="w-3 h-3" /> View details</>}
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={roleOverride}
            onChange={(e) => setRoleOverride(e.target.value)}
            className="input py-1 text-xs"
            title="Promote to role on approval"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </select>
          <button
            onClick={() => setRejectOpen(true)}
            disabled={approving || rejecting}
            className="btn-secondary text-xs py-1 px-2"
          >
            <XCircleIcon className="w-3.5 h-3.5" /> Reject
          </button>
          <button
            onClick={() => approve()}
            disabled={approving || rejecting}
            className="btn-primary text-xs py-1 px-2"
          >
            <CheckCircleIcon className="w-3.5 h-3.5" /> {approving ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject registration" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Reject <strong>{profile.full_name}</strong>'s registration. They'll see this reason on their account screen.
          </p>
          <textarea
            rows={3}
            className="input resize-none"
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setRejectOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => reject()} disabled={rejecting} className="btn-danger">
              {rejecting ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Approvals() {
  const { data, isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => profiles.listPending(),
    refetchInterval: 1000 * 30,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pending Approvals</h1>
        <p className="text-sm text-slate-500">{data?.length ?? 0} new registration{data?.length === 1 ? '' : 's'} awaiting review</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !data?.length ? (
        <EmptyState icon={UserIcon} title="No pending registrations" description="New users will appear here for review and approval." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.map((p) => <ApprovalCard key={p.id} profile={p} />)}
        </div>
      )}
    </div>
  );
}
