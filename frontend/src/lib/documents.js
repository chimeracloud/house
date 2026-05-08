import {
  collection, doc, getDoc, setDoc, getDocs, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db, firebaseAuth } from './firebase';

/**
 * Acknowledgement records live in `documents/{userId}_{docId}` so we can
 * upsert idempotently. A user accepting the same doc twice just refreshes
 * `signed_at`; an admin reading the collection sees the latest.
 */
const ackId = (userId, docId) => `${userId}_${docId}`;

export async function getAcknowledgement(userId, docId) {
  const snap = await getDoc(doc(db, 'documents', ackId(userId, docId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listAcknowledgementsForUser(userId) {
  const snap = await getDocs(query(collection(db, 'documents'), where('user_id', '==', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listAcknowledgementsForDoc(docId) {
  const snap = await getDocs(query(collection(db, 'documents'), where('doc_id', '==', docId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Sign / acknowledge a document. Records the typed name as a "signed by"
 * stamp — South African ECTA Section 13 treats a typed signature as a
 * valid electronic signature for non-notarised civil agreements.
 */
export async function signDocument(docId, { docVersion, docTitle, signedName }) {
  const u = firebaseAuth.currentUser;
  if (!u) throw new Error('Not signed in');
  if (!signedName?.trim()) throw new Error('Signature name required');

  const ref = doc(db, 'documents', ackId(u.uid, docId));
  await setDoc(ref, {
    user_id: u.uid,
    doc_id: docId,
    doc_title: docTitle,
    doc_version: docVersion,
    accepted: true,
    signed_name: signedName.trim(),
    signed_at: serverTimestamp(),
    parties: [u.uid], // expandable later for co-signers/witnesses
  }, { merge: true });

  const after = await getDoc(ref);
  return { id: after.id, ...after.data() };
}
