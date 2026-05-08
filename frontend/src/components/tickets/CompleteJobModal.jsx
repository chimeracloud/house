import { useState, useEffect } from 'react';
import { CameraIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '../ui/Modal';
import { uploadTicketAttachment } from '../../lib/upload';
import { tickets as ticketsApi } from '../../lib/data';

/**
 * Contractor-facing modal: upload "after" photos and submit the ticket
 * for inspection. Before-photos are displayed alongside as reference.
 */
export default function CompleteJobModal({ open, onClose, ticket }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setNotes('');
    }
  }, [open]);

  const beforeImages = (ticket?.attachments || [])
    .filter((a) => a.file_type === 'image' && (a.phase || 'before') === 'before');

  const handleFiles = (event) => {
    const picked = Array.from(event.target.files || []);
    setFiles((prev) => [...prev, ...picked]);
    event.target.value = '';
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = async () => {
    if (!files.length) {
      toast.error('Please attach at least one completion photo before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      // Upload all completion photos first.
      for (const file of files) {
        await uploadTicketAttachment(ticket.id, file, { phase: 'after' });
      }

      // Optional completion note.
      if (notes.trim()) {
        await ticketsApi.addComment(ticket.id, `Completion note: ${notes.trim()}`);
      }

      // Move ticket to awaiting_inspection.
      await ticketsApi.update(ticket.id, { status: 'awaiting_inspection' });

      qc.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Submitted for inspection');
      onClose();
    } catch (err) {
      const isStorage = /storage/i.test(err?.code || err?.message || '');
      toast.error(isStorage
        ? 'Photo upload failed: enable Firebase Storage (Blaze plan).'
        : err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit Job for Inspection" size="xl">
      <div className="space-y-5">
        <p className="text-sm text-slate-500">
          Upload your <strong>completion (NOW)</strong> photos. The property manager will compare
          them to the original issue photos before signing off the work.
        </p>

        {/* Before photos reference */}
        {beforeImages.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Issue photos (WAS)
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {beforeImages.map((att) => (
                <a
                  key={att.id}
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 block hover:opacity-80 transition-opacity"
                >
                  <img src={att.file_url} alt={att.label || att.file_name} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* After photos uploader */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Your completion photos (NOW) *
          </h3>

          <div className="flex flex-wrap gap-2 mb-2">
            {previews.map((url, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 group">
                <img src={url} alt={`Completion ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
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
                disabled={submitting}
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
                disabled={submitting}
              />
            </label>
          </div>
          {!files.length && (
            <p className="text-xs text-amber-500 mt-2">At least one completion photo is required.</p>
          )}
        </div>

        <div>
          <label className="label">Notes (optional)</label>
          <textarea
            rows={2}
            className="input resize-none"
            placeholder="Anything the manager should know during inspection..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !files.length}
            className="btn-primary"
          >
            {submitting ? 'Submitting…' : 'Submit for Inspection'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
