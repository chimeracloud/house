import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  PlusIcon, PencilSquareIcon, TrashIcon, HomeModernIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { roomsApi, profiles } from '../../lib/data';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';

const FLOORS = ['Ground', 'First', 'Second', 'Third', 'Other'];
const TYPES = ['single', 'double', 'family', 'common', 'kitchen', 'bathroom'];

export default function RoomsManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | { ...room }

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms-admin'],
    queryFn: () => roomsApi.list(),
  });

  const { data: tenants } = useQuery({
    queryKey: ['profiles-by-role', 'tenant'],
    queryFn: () => profiles.listByRole('tenant'),
  });

  const { mutate: del } = useMutation({
    mutationFn: (id) => roomsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms-admin'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room deleted');
    },
    onError: (e) => toast.error(e.message || 'Delete failed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{rooms?.length ?? 0} rooms configured</p>
        <button onClick={() => setEditing('new')} className="btn-primary text-xs">
          <PlusIcon className="w-3.5 h-3.5" /> Add Room
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : !rooms?.length ? (
        <EmptyState icon={HomeModernIcon} title="No rooms" description="Add the first room to get started." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rooms.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              onEdit={() => setEditing(r)}
              onDelete={() => {
                // eslint-disable-next-line no-restricted-globals, no-alert
                if (window.confirm(`Delete ${r.name || `Room ${r.number}`}?`)) del(r.id);
              }}
            />
          ))}
        </div>
      )}

      <RoomModal
        open={!!editing}
        onClose={() => setEditing(null)}
        room={editing === 'new' ? null : editing}
        tenants={tenants || []}
        onSaved={() => qc.invalidateQueries({ queryKey: ['rooms-admin'] })}
      />
    </div>
  );
}

function RoomCard({ room, onEdit, onDelete }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {room.name || `Room ${room.number}`}
          </h3>
          <p className="text-xs text-slate-500 capitalize">
            {room.floor ? `${room.floor} floor` : ''}{room.type ? ` · ${room.type}` : ''}
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
            <PencilSquareIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="text-slate-400 hover:text-red-600 p-1">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <dl className="text-xs space-y-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex justify-between">
          <dt className="text-slate-500">Tenant</dt>
          <dd className="text-slate-900 dark:text-white truncate ml-2">{room.tenant?.full_name || '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Monthly Rental</dt>
          <dd className="text-slate-900 dark:text-white">
            {room.monthly_rental ? `R ${Number(room.monthly_rental).toFixed(2)}` : '—'}
          </dd>
        </div>
        {room.lease_start && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Lease</dt>
            <dd className="text-slate-900 dark:text-white text-[11px]">
              {room.lease_start} → {room.lease_end || '—'}
            </dd>
          </div>
        )}
        {room.items?.length > 0 && (
          <div>
            <dt className="text-slate-500 text-[10px] uppercase mt-1.5">Items in room</dt>
            <dd className="text-[11px] text-slate-700 dark:text-slate-300">
              {room.items.join(', ')}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function RoomModal({ open, onClose, room, tenants, onSaved }) {
  const isEdit = !!room;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  // Reset the form whenever the room being edited changes (or when switching to "new").
  const lastKey = useRef(null);
  useEffect(() => {
    if (!open) return;
    const key = room?.id || 'new';
    if (lastKey.current === key) return;
    lastKey.current = key;
    reset({
      number: room?.number ?? '',
      name: room?.name ?? '',
      floor: room?.floor ?? '',
      type: room?.type ?? '',
      tenant_id: room?.tenant_id ?? '',
      monthly_rental: room?.monthly_rental ?? '',
      lease_start: room?.lease_start ?? '',
      lease_end: room?.lease_end ?? '',
      items: room?.items?.join(', ') ?? '',
      notes: room?.notes ?? '',
    });
  }, [open, room, reset]);

  const onSubmit = async (values) => {
    try {
      const payload = {
        number: values.number ? Number(values.number) : null,
        name: values.name || null,
        floor: values.floor || null,
        type: values.type || null,
        tenant_id: values.tenant_id || null,
        monthly_rental: values.monthly_rental ? Number(values.monthly_rental) : null,
        lease_start: values.lease_start || null,
        lease_end: values.lease_end || null,
        items: values.items ? values.items.split(',').map((s) => s.trim()).filter(Boolean) : [],
        notes: values.notes || null,
      };
      if (isEdit) {
        await roomsApi.update(room.id, payload);
        toast.success('Room updated');
      } else {
        await roomsApi.create(payload);
        toast.success('Room created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit ${room?.name || `Room ${room?.number}`}` : 'Add new room'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Room Number *</label>
            <input type="number" className="input" {...register('number', { required: 'Required' })} />
            {errors.number && <p className="text-xs text-red-500 mt-1">{errors.number.message}</p>}
          </div>
          <div>
            <label className="label">Display Name</label>
            <input className="input" placeholder="e.g. Garden Room" {...register('name')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Floor</label>
            <select className="input" {...register('floor')}>
              <option value="">Select…</option>
              {FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" {...register('type')}>
              <option value="">Select…</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Assigned Tenant</label>
            <select className="input" {...register('tenant_id')}>
              <option value="">— Vacant —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Monthly Rental (R)</label>
            <input type="number" step="0.01" className="input" {...register('monthly_rental')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Lease Start</label>
            <input type="date" className="input" {...register('lease_start')} />
          </div>
          <div>
            <label className="label">Lease End</label>
            <input type="date" className="input" {...register('lease_end')} />
          </div>
        </div>

        <div>
          <label className="label">Items in room</label>
          <input
            className="input"
            placeholder="Comma-separated (e.g. Bed, Wardrobe, Desk, Chair)"
            {...register('items')}
          />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea rows={2} className="input resize-none" {...register('notes')} />
        </div>

        <div className="text-[11px] text-slate-500 italic">
          Signed lease documents will appear here once the document signing feature is wired up.
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Saving…' : (isEdit ? 'Update Room' : 'Create Room')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
