import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { functions, db } from './firebase';

/**
 * Trigger the VerifyNow check suite for a tenant. Server-side only — the
 * API key is never sent to the client. Returns a summary object with a
 * 0–100 score and per-check pass/fail status.
 *
 * Throws if the function isn't deployed yet (graceful UI handles this:
 * the registration still completes, the user just sees a "verification
 * pending" state on the admin Approvals page until staff re-runs).
 */
export async function runVerifyTenant(uid) {
  const callable = httpsCallable(functions, 'verifyTenant');
  const result = await callable({ uid });
  return result.data;
}

export async function getVerifyNowCredits() {
  const callable = httpsCallable(functions, 'getVerifyNowCredits');
  const result = await callable();
  return result.data;
}

/** Read the verification doc that the function wrote (admin views). */
export async function getVerificationFor(uid) {
  const snap = await getDoc(doc(db, 'verifications', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
