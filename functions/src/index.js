import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { randomUUID } from 'crypto';

import {
  saidVerification,
  amlScreening,
  consumerTrace,
  bankAccountVerification,
  myCredits,
} from './verifynow/client.js';
import { buildSummary, buildOwnerEmail } from './verifynow/summary.js';

initializeApp();
const db = getFirestore();

const VERIFYNOW_API_KEY = defineSecret('VERIFYNOW_API_KEY');

const FUNCTION_OPTIONS = {
  region: 'europe-west1',
  secrets: [VERIFYNOW_API_KEY],
  timeoutSeconds: 60,
};

const STAFF_ROLES = ['admin', 'property_owner', 'property_manager'];

async function readProfile(uid) {
  const snap = await db.collection('profiles').doc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Profile not found');
  return { id: snap.id, ...snap.data() };
}

async function ensureCanRunFor(callerUid, targetUid) {
  if (callerUid === targetUid) return;
  const callerSnap = await db.collection('profiles').doc(callerUid).get();
  const role = callerSnap.exists ? callerSnap.data().role : null;
  if (!STAFF_ROLES.includes(role)) {
    throw new HttpsError('permission-denied', 'Only staff can run verification on other users.');
  }
}

/**
 * Callable: verifyTenant({ uid })
 *
 * Runs the VerifyNow check suite for the given tenant. Writes:
 *   - verifications/{uid}      → full + summary results
 *   - profiles/{uid}            → adds verification_score + verification_completed_at
 *   - mail/{auto}               → email to owner (Trigger Email Extension)
 *
 * Authorization: signed-in user can run on themselves; staff (admin / owner /
 * manager) can run on any user.
 */
export const verifyTenant = onCall(FUNCTION_OPTIONS, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');

  const targetUid = request.data?.uid || request.auth.uid;
  await ensureCanRunFor(request.auth.uid, targetUid);

  const profile = await readProfile(targetUid);
  if (!profile.id_number) {
    throw new HttpsError('failed-precondition', 'Profile is missing an ID number — cannot run verification.');
  }

  // Banking details (optional — bank check skipped if not present)
  let banking = null;
  try {
    const bSnap = await db.collection('banking_details').doc(targetUid).get();
    if (bSnap.exists) banking = bSnap.data();
  } catch {}

  // One idempotency key per logical operation, deterministic per user+attempt
  // so retries within 30 days of an attempt return cached responses.
  const attemptId = randomUUID();
  const idemFor = (op) => `${op}:${targetUid}:${attemptId}`;

  const fullName = profile.full_name || `${profile.first_name || ''} ${profile.surname || ''}`.trim();
  const surname = (fullName.split(' ').slice(-1)[0] || '').trim();
  const firstName = fullName.split(' ').slice(0, -1).join(' ').trim();

  const raw = {};
  let said, aml, trace, bank;

  try { said = await saidVerification(profile.id_number, idemFor('said')); }
  catch (e) { said = { success: false, error: e.message }; logger.warn('SAID failed', e); }
  raw.said_verification = said;

  try { aml = await amlScreening(fullName || surname, idemFor('aml'), { country: 'za' }); }
  catch (e) { aml = { success: false, error: e.message }; logger.warn('AML failed', e); }
  raw.aml_screening = aml;

  try { trace = await consumerTrace(profile.id_number, idemFor('trace')); }
  catch (e) { trace = { success: false, error: e.message }; logger.warn('Trace failed', e); }
  raw.consumer_trace = trace;

  if (banking?.account_number && banking?.branch_code) {
    try {
      bank = await bankAccountVerification({
        firstName,
        surname,
        identityNumber: profile.id_number,
        bankAccountNumber: banking.account_number,
        bankBranchCode: banking.branch_code,
        bankAccountType: banking.account_type || 'Savings',
      }, idemFor('bank'));
    } catch (e) {
      bank = { success: false, error: e.message };
      logger.warn('Bank check failed', e);
    }
    raw.bank_account_verification = bank;
  }

  const summary = buildSummary({ said, aml, trace, bank });

  // Persist
  await db.collection('verifications').doc(targetUid).set({
    user_id: targetUid,
    summary,
    raw,
    run_by: request.auth.uid,
    created_at: FieldValue.serverTimestamp(),
  });
  await db.collection('profiles').doc(targetUid).update({
    verification_score: summary.score,
    verification_completed_at: FieldValue.serverTimestamp(),
  });

  // Outbox email to property owner — Firebase "Trigger Email" extension
  // (firestore-send-email) picks documents out of `mail/` and sends them.
  // If the extension isn't installed, the doc just sits there harmlessly.
  try {
    const ownersSnap = await db.collection('profiles').where('role', '==', 'property_owner').get();
    const ownerEmails = ownersSnap.docs.map((d) => d.data().email).filter(Boolean);
    if (ownerEmails.length) {
      const { subject, text } = buildOwnerEmail({ profile, summary, raw });
      await db.collection('mail').add({
        to: ownerEmails,
        message: { subject, text },
        meta: { type: 'tenant_credit_check', user_id: targetUid },
        created_at: FieldValue.serverTimestamp(),
      });
    }
  } catch (e) {
    logger.error('Failed to enqueue owner email', e);
  }

  // Audit log
  try {
    await db.collection('audit_logs').add({
      user_id: request.auth.uid,
      action: 'tenant_verification_run',
      entity_type: 'profile',
      entity_id: targetUid,
      metadata: { score: summary.score },
      created_at: FieldValue.serverTimestamp(),
    });
  } catch {}

  return { score: summary.score, checks: summary.checks };
});

/**
 * Callable: getVerifyNowCredits()
 *
 * Used by an admin tile to display remaining credits on the VerifyNow account.
 * Callable so the API key never leaves the server.
 */
export const getVerifyNowCredits = onCall(FUNCTION_OPTIONS, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const callerSnap = await db.collection('profiles').doc(request.auth.uid).get();
  const role = callerSnap.exists ? callerSnap.data().role : null;
  if (!STAFF_ROLES.includes(role)) {
    throw new HttpsError('permission-denied', 'Staff only.');
  }
  return await myCredits();
});
