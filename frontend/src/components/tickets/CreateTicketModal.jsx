import { useForm } from 'react-hook-form';
import Modal from '../ui/Modal';
import { useCreateTicket } from '../../hooks/useTickets';
import { useRooms } from '../../hooks/useDashboard';

const CATEGORIES = ['Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Cleaning', 'Security', 'Pest Control', 'Other'];

export default function CreateTicketModal({ open, onClose }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { mutateAsync: createTicket, isPending } = useCreateTicket();
  const { data: rooms } = useRooms();

  const onSubmit = async (values) => {
    await createTicket({
      ...values,
      room_id: values.room_id || null,
      deadline: values.deadline || null,
      estimated_cost: values.estimated_cost ? Number(values.estimated_cost) : null,
    });
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Maintenance Ticket" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Title *</label>
          <input
            className="input"
            placeholder="e.g. Broken boiler in Room 3"
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
            <select className="input" {...register('priority', { required: true })}>
              <option value="low">Low</option>
              <option value="medium" defaultChecked>Medium</option>
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
          <label className="label">Estimated Cost (£)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            placeholder="0.00"
            {...register('estimated_cost')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
