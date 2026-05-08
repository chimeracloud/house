import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClockIcon, EnvelopeIcon, ArrowRightOnRectangleIcon,
  CheckCircleIcon, XCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function PendingApproval() {
  const profile = useAuthStore((s) => s.profile);
  const approvalStatus = useAuthStore((s) => s.approvalStatus);
  const sendVerificationEmail = useAuthStore((s) => s.sendVerificationEmail);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [resending, setResending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const isRejected = approvalStatus === 'rejected';

  const handleResend = async () => {
    setResending(true);
    try {
      await sendVerificationEmail();
      toast.success('Verification email sent');
    } catch (err) {
      toast.error(err.message || 'Could not send email');
    } finally {
      setResending(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const p = await refreshProfile();
      if (p?.is_active) {
        toast.success('Approved! Reloading…');
        navigate('/', { replace: true });
      } else {
        toast('Still awaiting approval', { icon: 'ℹ️' });
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 text-center shadow-2xl">
          {isRejected ? (
            <>
              <div className="w-14 h-14 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <XCircleIcon className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-lg font-bold text-white mb-2">Registration not approved</h1>
              <p className="text-sm text-slate-400 mb-4">
                Your registration was reviewed and not approved at this time.
              </p>
              {profile?.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-300 text-left mb-4">
                  <p className="font-semibold mb-1">Reason:</p>
                  <p>{profile.rejection_reason}</p>
                </div>
              )}
              <p className="text-xs text-slate-500 mb-6">
                If you think this was a mistake, contact the property manager directly.
              </p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                <ClockIcon className="w-8 h-8 text-amber-400" />
              </div>
              <h1 className="text-lg font-bold text-white mb-2">Application under review</h1>
              <p className="text-sm text-slate-400 mb-1">
                Hi {profile?.full_name || user?.email?.split('@')[0]} — thanks for registering as a{' '}
                <span className="text-slate-300 font-medium">{profile?.role?.replace('_', ' ')}</span>.
              </p>
              <p className="text-sm text-slate-400 mb-6">
                An administrator will review your application and approve your account.
                You'll receive an email once that's done.
              </p>

              <div className="space-y-3 text-left bg-slate-900/50 border border-slate-700 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2 text-xs">
                  {user?.emailVerified ? (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <ClockIcon className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className={user?.emailVerified ? 'text-emerald-300 font-medium' : 'text-slate-300 font-medium'}>
                      Email {user?.emailVerified ? 'verified' : 'verification pending'}
                    </p>
                    {!user?.emailVerified && (
                      <button
                        onClick={handleResend}
                        disabled={resending}
                        className="text-[11px] text-brand-400 hover:underline mt-1"
                      >
                        {resending ? 'Sending…' : 'Resend verification email'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs">
                  <ClockIcon className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-300 font-medium">Admin approval pending</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Usually takes 1–2 working days.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="auth-btn-secondary text-sm py-2"
            >
              {refreshing ? 'Checking…' : 'I\'ve been approved — refresh'}
            </button>
            <button
              onClick={logout}
              className="auth-btn-ghost text-xs py-2 inline-flex items-center justify-center gap-1.5"
            >
              <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-600 text-center mt-6">
          Need help? Contact your property manager.
        </p>
      </div>
    </div>
  );
}
