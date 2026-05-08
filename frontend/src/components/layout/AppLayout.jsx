import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Bars3Icon, ArrowRightOnRectangleIcon, BellIcon,
} from '@heroicons/react/24/outline';
import { Transition } from '@headlessui/react';
import { Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../stores/authStore';
import { useNotifications } from '../../hooks/useDashboard';
import toast from 'react-hot-toast';

function TopBarUserChip() {
  const profile = useAuthStore((s) => s.profile);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const { data: notifData } = useNotifications();
  const unread = notifData?.unread_count || 0;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      toast.error(err.message || 'Logout failed');
    }
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {/* Notifications */}
      <Link
        to="/notifications"
        className="relative p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title="Notifications"
      >
        <BellIcon className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>

      {/* User chip — non-clickable, shows current identity at a glance */}
      <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/50">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center">
            {profile?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="text-[11px] leading-tight max-w-[120px] truncate">
          <p className="font-medium text-slate-900 dark:text-white truncate">
            {profile?.full_name || 'User'}
          </p>
          <p className="text-slate-500 capitalize truncate">
            {role?.replace('_', ' ') || '—'}
          </p>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title="Sign out"
      >
        <ArrowRightOnRectangleIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <Transition show={mobileOpen} as="div">
        <Transition.Child
          enter="transition-opacity ease-linear duration-200"
          enterFrom="opacity-0" enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-200"
          leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        </Transition.Child>
        <Transition.Child
          enter="transition ease-in-out duration-200 transform"
          enterFrom="-translate-x-full" enterTo="translate-x-0"
          leave="transition ease-in-out duration-200 transform"
          leaveFrom="translate-x-0" leaveTo="-translate-x-full"
        >
          <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
            <Sidebar mobile onClose={() => setMobileOpen(false)} />
          </div>
        </Transition.Child>
      </Transition>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar — visible on every screen */}
        <header className="flex items-center justify-between px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
          {/* Left: mobile menu + brand label (mobile only) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Menu"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
            <span className="lg:hidden font-semibold text-sm text-slate-900 dark:text-white">
              Rosy Morn
            </span>
          </div>

          {/* Right: notifications + user + logout — always visible */}
          <TopBarUserChip />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
