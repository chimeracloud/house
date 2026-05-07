import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

if (!getApps().length) {
  initializeApp({
    // On Cloud Run, ADC (Application Default Credentials) is picked up automatically.
    // Locally, GOOGLE_APPLICATION_CREDENTIALS env var points to the service account JSON file.
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'rosy-morn-prop-2026.firebasestorage.app',
  });
}

export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();

// Helper: convert Firestore doc to plain object with id
export function docToObj(doc) {
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

// Helper: convert query snapshot to array
export function snapToArr(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export { FieldValue };
