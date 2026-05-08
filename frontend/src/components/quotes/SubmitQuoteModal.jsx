import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import { useSubmitQuote } from '../../hooks/useQuotes';

const ITEM_TYPES = ['labour', 'material', 'equipment', 'other'];

export default function SubmitQuoteModal({ open, onClose, ticketId, ticketTitle }) {
  const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: {
      items: [{ description: '', item_type: 'labour', quantity: 1, unit_price: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const { mutateAsync: submitQuote, isPending } = useSubmitQuote();
  const watchItems = watch('items');

  const total = watchItems.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }, 0);

  const onSubmit = async (values) => {
    await submitQuote({
      ticket_id: ticketId,
      items: values.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
      })),
      valid_until: values.valid_until,
      notes: values.notes,
      estimated_days: values.estimated_days ? Number(values.estimated_days) : null,
    });
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit Quotation" size="xl">
      {ticketTitle && (
        <p className="text-sm text-slate-500 -mt-2 mb-4">For: <strong className="text-slate-700 dark:text-slate-300">{ticketTitle}</strong></p>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Line Items *</label>
            <button
              type="button"
              onClick={() => append({ description: '', item_type: 'labour', quantity: 1, unit_price: '' })}
              className="btn-ghost text-xs py-1 px-2"
            >
              <PlusIcon className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>

          <div className="space-y-2">
            {fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  <input
                    className="input text-xs"
                    placeholder="Description"
                    {...register(`items.${idx}.description`, { required: true })}
                  />
                </div>
                <div className="col-span-2">
                  <select className="input text-xs" {...register(`items.${idx}.item_type`)}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="number" step="0.5" min="0.5"
                    className="input text-xs"
                    placeholder="Qty"
                    {...register(`items.${idx}.quantity`, { required: true, min: 0.01 })}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number" step="0.01" min="0"
                    className="input text-xs"
                    placeholder="R unit"
                    {...register(`items.${idx}.unit_price`, { required: true, min: 0 })}
                  />
                </div>
                <div className="col-span-1 flex items-center justify-center pt-1.5">
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Total: <span className="text-brand-600">R {total.toFixed(2)}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Valid Until *</label>
            <input
              type="date"
              className="input"
              {...register('valid_until', { required: 'Valid until date required' })}
            />
            {errors.valid_until && <p className="text-xs text-red-500 mt-1">{errors.valid_until.message}</p>}
          </div>
          <div>
            <label className="label">Estimated Days to Complete</label>
            <input
              type="number" min="1"
              className="input"
              placeholder="e.g. 3"
              {...register('estimated_days')}
            />
          </div>
        </div>

        <div>
          <label className="label">Notes / Terms</label>
          <textarea rows={2} className="input resize-none" placeholder="Any additional notes or terms..." {...register('notes')} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? 'Submitting...' : 'Submit Quotation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
