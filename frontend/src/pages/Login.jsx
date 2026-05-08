import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import Register from './Register';
import ForgotPassword from './ForgotPassword';

const TABS = [
  { key: 'signin',   label: 'Sign In' },
  { key: 'register', label: 'Register' },
  { key: 'forgot',   label: 'Forgot Password' },
];

function SignInForm({ onSwitchTab }) {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const onSubmit = async ({ email, password }) => {
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const code = err.code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please try again later.');
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-xs text-slate-300 mb-1">Email address</label>
        <input
          type="email"
          autoComplete="email"
          className="auth-input"
          placeholder="you@example.com"
          {...register('email', { required: 'Email is required' })}
        />
        {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-slate-300">Password</label>
          <button type="button" onClick={() => onSwitchTab('forgot')} className="text-[11px] text-brand-400 hover:underline">
            Forgot?
          </button>
        </div>
        <input
          type="password"
          autoComplete="current-password"
          className="auth-input"
          placeholder="••••••••"
          {...register('password', { required: 'Password is required' })}
        />
        {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="auth-btn-primary text-sm w-full py-2.5"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-xs text-slate-500 text-center">
        Don't have an account?{' '}
        <button type="button" onClick={() => onSwitchTab('register')} className="text-brand-400 hover:underline">
          Register
        </button>
      </p>
    </form>
  );
}

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'signin';
  const [tab, setTab] = useState(initialTab);

  const switchTab = (next) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'signin') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 py-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-900/20 to-transparent" />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-900/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-brand-800/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
            <BuildingOfficeIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Rosy Morn</h1>
            <p className="text-xs text-slate-400">Property Management Console</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 sm:p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-lg bg-slate-900/60 mb-6">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${tab === t.key ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'signin' && <SignInForm onSwitchTab={switchTab} />}
          {tab === 'register' && <Register onSwitchTab={switchTab} />}
          {tab === 'forgot' && <ForgotPassword onSwitchTab={switchTab} />}
        </div>

        <p className="text-xs text-slate-600 text-center mt-6">
          © {new Date().getFullYear()} Ascot Wealth Management · All rights reserved
        </p>
      </div>
    </div>
  );
}
