/**
 * VerifyNow API client.
 *
 * Docs: https://www.verifynow.co.za/api/external
 *
 * Reads the API key from VERIFYNOW_API_KEY environment variable
 * (set via `firebase functions:secrets:set VERIFYNOW_API_KEY` for production).
 *
 * Mode: production by default. Override with VERIFYNOW_MODE=sandbox in env
 * to hit the free sandbox endpoints (mock data, no credit usage).
 */

const BASE_URL = 'https://www.verifynow.co.za/api/external';

function getMode() {
  return process.env.VERIFYNOW_MODE === 'sandbox' ? 'sandbox' : 'production';
}

function requireKey() {
  const key = process.env.VERIFYNOW_API_KEY;
  if (!key) {
    throw new Error(
      'VERIFYNOW_API_KEY is not configured. Run: firebase functions:secrets:set VERIFYNOW_API_KEY'
    );
  }
  return key;
}

async function call(path, body, idempotencyKey) {
  const headers = {
    'x-api-key': requireKey(),
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, mode: getMode() }),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    const err = new Error(json?.message || `VerifyNow ${path} returned ${res.status}`);
    err.status = res.status;
    err.detail = json;
    throw err;
  }
  return json;
}

/** Cheap (R2.99) – validates that a SA ID number exists at Home Affairs. */
export const saidVerification = (idNumber, idempotencyKey) =>
  call('/verify', { reportType: 'said_verification', idNumber }, idempotencyKey);

/** R29.90 – returns Home Affairs photo + ID demographics (use for face match). */
export const idPhoto = (idNumber, idempotencyKey) =>
  call('/verify', { reportType: 'home_affairs_id_photo', idNumber }, idempotencyKey);

/** R29.90 – addresses, employers, contact numbers. */
export const consumerTrace = (idNumber, idempotencyKey) =>
  call('/verify', { reportType: 'consumer_trace', idNumber }, idempotencyKey);

/** R11.96 – consumer-trace lite. */
export const consumerTraceLite = (idNumber, idempotencyKey) =>
  call('/consumer-trace-lite', { idNumber }, idempotencyKey);

/** R14.95 – sanctions / PEP / crime list screening. */
export const amlScreening = (name, idempotencyKey, opts = {}) =>
  call(
    '/aml-screening',
    {
      name,
      entity: opts.entity ?? 0,        // 0 = person
      country: opts.country || 'za',
      dataset: opts.dataset || 'all',
    },
    idempotencyKey,
  );

/** R17.94 – bank account ownership check. */
export const bankAccountVerification = (params, idempotencyKey) =>
  call(
    '/bank-account-verification',
    {
      type: params.type || 'Individual',
      firstName: params.firstName || '',
      surname: params.surname,
      identityNumber: params.identityNumber,
      identityType: params.identityType || 'IDNumber',
      bankAccountNumber: params.bankAccountNumber,
      bankBranchCode: params.bankBranchCode,
      bankAccountType: params.bankAccountType || 'Savings',
    },
    idempotencyKey,
  );

/** Health check – confirms credentials are live and credits remain. */
export const myCredits = async () => {
  const res = await fetch(`${BASE_URL}/my_credits`, {
    method: 'GET',
    headers: { 'x-api-key': requireKey() },
  });
  return res.json();
};
