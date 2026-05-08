/**
 * Reduces a bundle of VerifyNow responses into a single summary object that's
 * cheap to render in the UI and safe to expose to managers/owners.
 *
 * Score is a 0–100 confidence value derived from individual checks:
 *   - SAID Verification matches & not deceased       +30
 *   - AML/PEP screening clear (no matches)            +30
 *   - Consumer trace returned data                    +20
 *   - Bank account verified to identity               +20
 */
export function buildSummary({ said, aml, trace, bank }) {
  const checks = [];
  let score = 0;
  let max = 0;

  // SAID
  max += 30;
  if (said?.success) {
    const r = said.results?.said_verification || said.result || {};
    const matched = r.success === true || r.Status === 'Success';
    const dead = (r.Dead_Indicator || r.DeadIndicator || '').toLowerCase() === 'yes';
    if (matched && !dead) score += 30;
    checks.push({
      key: 'said',
      label: 'SA ID Verification',
      pass: matched && !dead,
      detail: matched
        ? (dead ? 'ID flagged as deceased' : `${r.FirstNames || r.Name || ''} ${r.Surname || ''}`.trim())
        : 'ID not found at Home Affairs',
    });
  } else {
    checks.push({ key: 'said', label: 'SA ID Verification', pass: false, detail: said?.error || 'Failed' });
  }

  // AML
  max += 30;
  if (aml?.success) {
    const matches = aml.results?.match || [];
    const clear = Array.isArray(matches) && matches.length === 0;
    if (clear) score += 30;
    checks.push({
      key: 'aml',
      label: 'AML / PEP / Sanctions',
      pass: clear,
      detail: clear ? 'No matches across sanctions, PEP and crime lists' : `${matches.length} match(es) found — review`,
    });
  } else {
    checks.push({ key: 'aml', label: 'AML / PEP / Sanctions', pass: false, detail: aml?.error || 'Failed' });
  }

  // Consumer trace
  max += 20;
  if (trace?.success) {
    const t = trace.results?.consumer_trace || {};
    const hasData = !!(t.addresses?.length || t.employers?.length || t.contact_numbers?.length);
    if (hasData) score += 20;
    checks.push({
      key: 'trace',
      label: 'Consumer Trace',
      pass: hasData,
      detail: hasData
        ? `${t.addresses?.length || 0} address(es), ${t.employers?.length || 0} employer(s)`
        : 'No trace data returned',
    });
  } else {
    checks.push({ key: 'trace', label: 'Consumer Trace', pass: false, detail: trace?.error || 'Skipped' });
  }

  // Bank
  max += 20;
  if (bank?.success) {
    const v = bank.results?.verification_results || {};
    const verified = bank.results?.identity_and_account_verified === true
      || (v.identityMatch === 'Yes' && v.accountFound === 'Yes' && v.accountOpen === 'Yes');
    if (verified) score += 20;
    checks.push({
      key: 'bank',
      label: 'Bank Account Verification',
      pass: verified,
      detail: verified ? 'Account belongs to applicant and is open' : 'Could not verify account ownership',
    });
  } else {
    checks.push({ key: 'bank', label: 'Bank Account Verification', pass: null, detail: 'Skipped — no banking details captured' });
  }

  return {
    score: Math.round((score / Math.max(1, max)) * 100),
    checks,
    completed_at: new Date().toISOString(),
  };
}

/**
 * Build the email body sent to the owner with the full result set.
 */
export function buildOwnerEmail({ profile, summary, raw }) {
  const subject = `Tenant Application - 21 Breda - Credit Check`;
  const passList = summary.checks
    .map((c) => `  • ${c.label}: ${c.pass === true ? 'PASS' : c.pass === false ? 'FAIL' : 'SKIPPED'} — ${c.detail}`)
    .join('\n');

  const text = [
    `New tenant application received: ${profile.full_name || profile.email || profile.id}`,
    ``,
    `Applicant`,
    `---------`,
    `Full name:    ${profile.full_name || ''}`,
    `Email:        ${profile.email || ''}`,
    `Phone:        ${profile.phone || ''}`,
    `ID number:    ${profile.id_number || ''}`,
    `Marital:      ${profile.marital_status || ''}`,
    `Income (R):   ${profile.monthly_nett_income || ''}`,
    `Work address: ${profile.work_address || ''}`,
    ``,
    `Verification summary (score ${summary.score}/100)`,
    `--------------------------------------------------`,
    passList,
    ``,
    `Full results are attached as JSON below for the records.`,
    ``,
    `--- RAW VERIFYNOW RESPONSES ---`,
    JSON.stringify(raw, null, 2),
  ].join('\n');

  return { subject, text };
}
