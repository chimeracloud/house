import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { CameraIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useCreateTicket } from '../../hooks/useTickets';
import { useRooms } from '../../hooks/useDashboard';
import { uploadTicketAttachment } from '../../lib/upload';

const CATEGORIES = ['Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Cleaning', 'Security', 'Pest Control', 'Other'];

export default function CreateTicketModal({ open, onClose }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { mutateAsync: createTicket, isPending } = useCreateTicket();
  const { data: rooms } = useRooms();

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Build preview URLs whenever files change; revoke old ones to avoid leaks
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const handleFiles = (event) => {
    const picked = Array.from(event.target.files || []);
    setFiles((prev) => [...prev, ...picked]);
    event.target.value = '';
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const close = () => {
    reset();
    setFiles([]);
    onClose();
  };

  const onSubmit = async (values) => {
    try {
      const ticket = await createTicket({
        ...values,
        room_id: values.room_id || null,
        deadline: values.deadline || null,
        estimated_cost: values.estimated_cost ? Number(values.estimated_cost) : null,
      });

      if (files.length && ticket?.id) {
        setUploading(true);
        try {
          for (const file of files) {
            await uploadTicketAttachment(ticket.id, file, { phase: 'before' });
          }
          toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} attached`);
        } catch (err) {
          const isStorage = /storage/i.test(err?.code || err?.message || '');
          toast.error(isStorage
            ? 'Photos failed: enable Firebase Storage (Blaze plan) to attach images.'
            : 'Some photos failed to upload — open the ticket to retry.');
        } finally {
          setUploading(false);
        }
      }

      close();
    } catch (err) {
      // useCreateTicket already toasts the error
    }
  };

  return (
    <Modal open={open} onClose={close} title="Log Maintenance Ticket" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Title *</label>
          <input
            className="input"
            placeholder="e.g. Broken geyser in Room 3"
            {...register('title', { required: 'Title is required' })}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="label">Description *</label>
          <textarea
            rows={3}
            className="input resize-none"
            placeholder="Describe the issue in detail..."
            {...register('description', { required: 'Description is required' })}
          />
          {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Priority *</label>
            <select className="input" defaultValue="medium" {...register('priority', { required: true })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" {...register('category')}>
              <option value="">Select category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Location / Room</label>
            <select className="input" {...register('room_id')}>
              <option value="">Select room</option>
              {(rooms || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || `Room ${r.number}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Deadline</label>
            <input type="date" className="input" {...register('deadline')} />
          </div>
        </div>

        <div>
          <label className="label">Estimated Cost (R)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            placeholder="0.00"
            {...register('estimated_cost')}
          />
        </div>

        {/* Photos */}
        <div>
          <label className="label">Photos of the issue</label>
          <p className="text-xs text-slate-500 mb-2">
            Take a photo or attach existing pictures. These are the &quot;before&quot; reference
            against which the contractor&apos;s completion photos will be compared.
          </p>

          <div className="flex flex-wrap gap-2 mb-2">
            {previews.map((url, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 group">
                <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Remove"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary text-xs cursor-pointer">
              <CameraIcon className="w-3.5 h-3.5" />
              Take photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFiles}
              />
            </label>
            <label className="btn-secondary text-xs cursor-pointer">
              <PhotoIcon className="w-3.5 h-3.5" />
              Choose photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFiles}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={close} className="btn-secondary" disabled={isPending || uploading}>
            Cancel
          </button>
          <button type="submit" disabled={isPending || uploading} className="btn-primary">
            {uploading ? 'Uploading photos…' : isPending ? 'Creating…' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
