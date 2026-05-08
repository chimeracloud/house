import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import {
  CheckIcon, ArrowLeftIcon, ArrowRightIcon,
  CameraIcon, PhotoIcon, BuildingOfficeIcon, PlusIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import { firebaseAuth, storage } from '../lib/firebase';
import { registration } from '../lib/data';

const ROLE_OPTIONS = [
  { value: 'tenant',     label: 'Tenant',     description: 'I want to rent a room at this property' },
  { value: 'contractor', label: 'Contractor', description: 'I provide repair / maintenance services' },
  { value: 'property_manager', label: 'Manager',    description: 'I manage the property on behalf of the owner' },
];

const STEPS = ['Account', 'Identity', 'Role-specific', 'Banking & Consent'];

export default function Register({ onSwitchTab }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);

  const { register, handleSubmit, watch, control, getValues, trigger, formState: { errors } } = useForm({
    mode: 'onTouched',
    defaultValues: {
      role: 'tenant',
      references: [{ name: '', phone: '' }],
    },
  });
  const { fields: refFields, append: appendRef, remove: removeRef } = useFieldArray({ control, name: 'references' });
  const role = watch('role');

  useEffect(() => {
    if (!selfieFile) { setSelfiePreview(null); return; }
    const url = URL.createObjectURL(selfieFile);
    setSelfiePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selfieFile]);

  const handleSelfie = (e) => {
    const f = e.target.files?.[0];
    if (f) setSelfieFile(f);
  };

  // Per-step field validation before advancing
  const stepFields = (s) => {
    switch (s) {
      case 0: return ['full_name', 'email', 'password', 'mobile', 'role'];
      case 1: return ['id_number'];
      case 2:
        if (role === 'tenant') return ['marital_status', 'previous_address', 'monthly_nett_income'];
        if (role === 'contractor') return ['company_name', 'services'];
        if (role === 'property_manager') return ['work_address'];
        return [];
      case 3: return role === 'property_owner' ? [] : [];
      default: return [];
    }
  };

  const next = async () => {
    const ok = await trigger(stepFields(step));
    if (!ok) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const onSubmit = async (values) => {
    if (role === 'tenant' && !values.credit_check_consent) {
      toast.error('You must consent to the credit check to register as a tenant.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(firebaseAuth, values.email, values.password);
      const uid = cred.user.uid;

      // 2. Send verification email (works on Spark)
      try { await sendEmailVerification(cred.user); } catch { /* non-fatal */ }

      // 3. Selfie upload (if provided + Storage available)
      let avatar_url = null;
      if (selfieFile && role !== 'property_owner') {
        try {
          const path = `selfies/${uid}/${Date.now()}_${selfieFile.name.replace(/\s+/g, '_')}`;
          const ref = storageRef(storage, path);
          await uploadBytes(ref, selfieFile, { contentType: selfieFile.type });
          avatar_url = await getDownloadURL(ref);
        } catch (err) {
          toast('Selfie upload skipped (Storage not enabled). You can add it later in Settings.', { icon: 'ℹ️' });
        }
      }

      // 4. Submit profile + role-specific fields + banking + references
      await registration.submit({
        role,
        common: {
          full_name: values.full_name,
          phone: values.mobile,
          id_number: values.id_number,
          avatar_url,
          work_address: values.work_address || null,
          next_of_kin_name: values.next_of_kin_name || null,
          next_of_kin_phone: values.next_of_kin_phone || null,
          medical_conditions: values.medical_conditions || null,
        },
        tenant: role === 'tenant' ? {
          marital_status: values.marital_status,
          previous_address: values.previous_address,
          previous_was_owner: values.previous_was_owner === 'owner',
          previous_landlord_name: values.previous_landlord_name || null,
          previous_landlord_phone: values.previous_landlord_phone || null,
          previous_landlord_contact_consent: !!values.previous_landlord_contact_consent,
          previous_address_comment: values.previous_address_comment || null,
          monthly_nett_income: values.monthly_nett_income ? Number(values.monthly_nett_income) : null,
          credit_check_consent: !!values.credit_check_consent,
          credit_check_consent_at: new Date().toISOString(),
        } : null,
        contractor: role === 'contractor' ? {
          company_name: values.company_name,
          services: values.services,
        } : null,
        references: role === 'contractor' ? (values.references || []).filter((r) => r.name?.trim()) : null,
        banking: role !== 'property_owner' ? {
          account_holder: values.banking_account_holder || null,
          bank: values.banking_bank || null,
          account_number: values.banking_account_number || null,
          branch_code: values.banking_branch_code || null,
        } : null,
      });

      // Sign out so they don't accidentally see the app while pending — they
      // can sign back in and see the "pending approval" screen.
      await signOut(firebaseAuth);
      toast.success('Registration submitted. Verification email sent — please verify, then sign in.');
      navigate('/login', { replace: true });
      onSwitchTab?.('signin');
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/email-already-in-use') toast.error('That email already has an account. Try signing in instead.');
      else if (code === 'auth/weak-password') toast.error('Password too weak. Use at least 6 characters.');
      else if (code === 'auth/invalid-email') toast.error('Invalid email address.');
      else toast.error(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Stepper */}
      <ol className="flex items-center gap-2 text-xs text-slate-400">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-semibold ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {i < step ? <CheckIcon className="w-3 h-3" /> : i + 1}
            </span>
            <span className={i === step ? 'text-slate-100 font-medium' : ''}>{label}</span>
            {i < STEPS.length - 1 && <span className="text-slate-700">›</span>}
          </li>
        ))}
      </ol>

      {/* STEP 0: Account */}
      {step === 0 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Full Name *</label>
            <input className="auth-input" placeholder="John Doe" {...register('full_name', { required: 'Required' })} />
            {errors.full_name && <p className="text-xs text-red-400 mt-1">{errors.full_name.message}</p>}
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Mobile Number *</label>
            <input className="auth-input" placeholder="+27 82 123 4567" {...register('mobile', { required: 'Required' })} />
            <p className="text-[11px] text-slate-500 mt-1">SMS verification will be added later — you'll be prompted in your profile.</p>
            {errors.mobile && <p className="text-xs text-red-400 mt-1">{errors.mobile.message}</p>}
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Email *</label>
            <input type="email" autoComplete="email" className="auth-input" placeholder="you@example.com"
              {...register('email', { required: 'Required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
            <p className="text-[11px] text-slate-500 mt-1">We'll send a verification email after registration.</p>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Password *</label>
            <input type="password" autoComplete="new-password" className="auth-input" placeholder="Min. 6 characters"
              {...register('password', { required: 'Required', minLength: { value: 6, message: 'At least 6 characters' } })} />
            {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Applying as *</label>
            <Controller
              control={control}
              name="role"
              rules={{ required: true }}
              render={({ field }) => (
                <div className="grid grid-cols-1 gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <label key={r.value} className={`p-3 rounded-lg border cursor-pointer transition-colors ${field.value === r.value ? 'bg-brand-600/20 border-brand-500' : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'}`}>
                      <input type="radio" value={r.value} className="sr-only" checked={field.value === r.value} onChange={() => field.onChange(r.value)} />
                      <div className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${field.value === r.value ? 'border-brand-500 bg-brand-500' : 'border-slate-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-white">{r.label}</p>
                          <p className="text-xs text-slate-400">{r.description}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            />
            <p className="text-[11px] text-slate-500 mt-1">Owner and Admin accounts are created by an existing admin only.</p>
          </div>
        </div>
      )}

      {/* STEP 1: Identity */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-300 mb-1">ID Number *</label>
            <input className="auth-input" placeholder="13-digit RSA ID number" {...register('id_number', { required: 'Required' })} />
            {errors.id_number && <p className="text-xs text-red-400 mt-1">{errors.id_number.message}</p>}
          </div>

          {role !== 'property_owner' && (
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Selfie / Profile Photo</label>
              <div className="flex items-start gap-3">
                {selfiePreview ? (
                  <img src={selfiePreview} alt="Selfie preview" className="w-20 h-20 rounded-full object-cover border-2 border-slate-700" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500">
                    <CameraIcon className="w-6 h-6" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <label className="auth-btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5">
                    <CameraIcon className="w-3.5 h-3.5" />
                    Take selfie
                    <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleSelfie} />
                  </label>
                  <label className="auth-btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5">
                    <PhotoIcon className="w-3.5 h-3.5" />
                    Upload photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleSelfie} />
                  </label>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Used by management for security verification on site.</p>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Role-specific */}
      {step === 2 && (
        <div className="space-y-3">
          {role === 'tenant' && (
            <>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Marital Status *</label>
                <select className="auth-input" {...register('marital_status', { required: 'Required' })}>
                  <option value="">Select…</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                  <option value="other">Other</option>
                </select>
                {errors.marital_status && <p className="text-xs text-red-400 mt-1">{errors.marital_status.message}</p>}
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Monthly Nett Income (R) *</label>
                <input type="number" step="0.01" className="auth-input" placeholder="e.g. 25000"
                  {...register('monthly_nett_income', { required: 'Required', min: 0 })} />
                {errors.monthly_nett_income && <p className="text-xs text-red-400 mt-1">{errors.monthly_nett_income.message}</p>}
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Work Address</label>
                <input className="auth-input" placeholder="Office address" {...register('work_address')} />
              </div>

              <div className="border-t border-slate-700 pt-3">
                <p className="text-xs text-slate-400 font-semibold mb-2">Previous Residential Address</p>
                <div className="space-y-3">
                  <textarea rows={2} className="auth-input resize-none" placeholder="Full previous address"
                    {...register('previous_address', { required: 'Required' })} />
                  {errors.previous_address && <p className="text-xs text-red-400 -mt-2">{errors.previous_address.message}</p>}

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Were you the owner or tenant?</label>
                    <select className="auth-input" {...register('previous_was_owner')}>
                      <option value="tenant">Tenant</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>

                  {watch('previous_was_owner') !== 'owner' && (
                    <>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Previous Landlord Name</label>
                        <input className="auth-input" {...register('previous_landlord_name')} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">Previous Landlord Phone</label>
                        <input className="auth-input" {...register('previous_landlord_phone')} />
                      </div>
                      <label className="flex items-start gap-2 text-xs text-slate-300">
                        <input type="checkbox" className="mt-0.5" {...register('previous_landlord_contact_consent')} />
                        May we contact your previous landlord?
                      </label>
                    </>
                  )}

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Comments</label>
                    <textarea rows={2} className="auth-input resize-none" {...register('previous_address_comment')} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Next of Kin Name</label>
                <input className="auth-input" {...register('next_of_kin_name')} />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Next of Kin Phone</label>
                <input className="auth-input" {...register('next_of_kin_phone')} />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Medical Conditions / Special Medication</label>
                <textarea rows={2} className="auth-input resize-none" placeholder="Anything we should know in case of emergency"
                  {...register('medical_conditions')} />
              </div>
            </>
          )}

          {role === 'contractor' && (
            <>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Company Name *</label>
                <input className="auth-input" {...register('company_name', { required: 'Required' })} />
                {errors.company_name && <p className="text-xs text-red-400 mt-1">{errors.company_name.message}</p>}
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Services Offered *</label>
                <input className="auth-input" placeholder="e.g. Plumbing, Electrical, Painting"
                  {...register('services', { required: 'Required' })} />
                {errors.services && <p className="text-xs text-red-400 mt-1">{errors.services.message}</p>}
              </div>

              <div className="border-t border-slate-700 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400 font-semibold">Contactable References</p>
                  <button type="button" onClick={() => appendRef({ name: '', phone: '' })}
                    className="auth-btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1">
                    <PlusIcon className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {refFields.map((field, idx) => (
                    <div key={field.id} className="flex gap-2">
                      <input className="auth-input flex-1" placeholder="Name" {...register(`references.${idx}.name`)} />
                      <input className="auth-input flex-1" placeholder="Phone" {...register(`references.${idx}.phone`)} />
                      {refFields.length > 1 && (
                        <button type="button" onClick={() => removeRef(idx)} className="text-red-400 hover:text-red-300 px-2">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {role === 'property_manager' && (
            <>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Work Address *</label>
                <input className="auth-input" {...register('work_address', { required: 'Required' })} />
                {errors.work_address && <p className="text-xs text-red-400 mt-1">{errors.work_address.message}</p>}
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Next of Kin Name</label>
                <input className="auth-input" {...register('next_of_kin_name')} />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Next of Kin Phone</label>
                <input className="auth-input" {...register('next_of_kin_phone')} />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Medical Conditions / Special Medication</label>
                <textarea rows={2} className="auth-input resize-none" {...register('medical_conditions')} />
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 3: Banking + Consent */}
      {step === 3 && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-400 font-semibold mb-2">Banking Details</p>
            <p className="text-[11px] text-slate-500 mb-2">
              Used for {role === 'contractor' ? 'invoice payouts' : 'rental debit orders'}. Stored securely
              and only visible to admin and owner.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input className="auth-input" placeholder="Account holder" {...register('banking_account_holder')} />
              <input className="auth-input" placeholder="Bank" {...register('banking_bank')} />
              <input className="auth-input" placeholder="Account number" {...register('banking_account_number')} />
              <input className="auth-input" placeholder="Branch code" {...register('banking_branch_code')} />
            </div>
          </div>

          {role === 'tenant' && (
            <div className="border-t border-slate-700 pt-3 space-y-3">
              <p className="text-xs text-slate-400 font-semibold">Credit Check & Police Clearance</p>
              <p className="text-[11px] text-slate-500">
                As part of the tenant approval process, the property owner runs a credit check and a
                basic background screening. Results are reviewed by the owner only.
              </p>
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input type="checkbox" className="mt-0.5" {...register('credit_check_consent', { required: true })} />
                <span>
                  I consent to a <strong>credit check and police clearance</strong> being performed
                  using the information I have provided.
                </span>
              </label>
              {errors.credit_check_consent && (
                <p className="text-xs text-red-400">You must consent to register as a tenant.</p>
              )}
            </div>
          )}

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-[11px] text-slate-400">
            After submitting, your account is created but <strong>access is restricted</strong> until
            an administrator reviews and approves your registration. You'll be notified by email
            once approved.
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700">
        <button
          type="button"
          onClick={prev}
          disabled={step === 0}
          className="auth-btn-ghost text-xs inline-flex items-center gap-1.5 px-3 py-2 disabled:opacity-30"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="auth-btn-primary text-xs inline-flex items-center gap-1.5 px-3 py-2"
          >
            Next <ArrowRightIcon className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={submitting}
            className="auth-btn-primary text-xs inline-flex items-center gap-1.5 px-4 py-2"
          >
            {submitting ? 'Submitting…' : 'Submit Registration'}
          </button>
        )}
      </div>
    </form>
  );
}
