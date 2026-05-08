import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';

export default function ForgotPassword({ onSwitchTab }) {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async ({ email }) => {
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
      toast.success('Check your inbox for a reset link');
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/user-not-found') {
        // Pretend success to avoid leaking which emails exist
        setSent(true);
        toast.success('If that account exists, we sent a reset link');
      } else if (code === 'auth/invalid-email') {
        toast.error('Invalid email address');
      } else {
        toast.error(err.message || 'Could not send reset email');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center py-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm text-slate-300">
          Reset link sent. Check your inbox (and spam folder) for an email from Firebase.
        </p>
        <button onClick={() => onSwitchTab?.('signin')} className="auth-btn-primary text-sm w-full py-2.5">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-xs text-slate-400">
        Enter the email associated with your account. We'll send you a link to reset your password.
      </p>

      <div>
        <label className="block text-xs text-slate-300 mb-1">Email address</label>
        <input
          type="email"
          autoComplete="email"
          className="auth-input"
          placeholder="you@example.com"
          {...register('email', { required: 'Required' })}
        />
        {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
      </div>

      <button type="submit" disabled={submitting} className="auth-btn-primary text-sm w-full py-2.5">
        {submitting ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="text-xs text-slate-500 text-center">
        Remembered it?{' '}
        <button type="button" onClick={() => onSwitchTab?.('signin')} className="text-brand-400 hover:underline">
          Back to sign in
        </button>
      </p>
    </form>
  );
}
