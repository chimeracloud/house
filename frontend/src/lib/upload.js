import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, firebaseAuth } from './firebase';
import { tickets } from './data';

const detectFileType = (mimeType, fileName) => {
  if (!mimeType && fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) return 'video';
    if (ext === 'pdf') return 'document';
  }
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('video/')) return 'video';
  return 'document';
};

export async function uploadTicketAttachment(ticketId, file, { label, phase = 'before' } = {}) {
  if (!firebaseAuth.currentUser) throw new Error('Not signed in');

  const path = `tickets/${ticketId}/${phase}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const ref = storageRef(storage, path);

  await uploadBytes(ref, file, { contentType: file.type });
  const url = await getDownloadURL(ref);

  return tickets.addAttachment(ticketId, {
    file_name: file.name,
    file_url: url,
    file_path: path,
    file_type: detectFileType(file.type, file.name),
    label: label || null,
    mime_type: file.type || null,
    phase,
  });
}
