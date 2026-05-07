import { NavLink } from 'react-router-dom';
import {
  HomeIcon, WrenchScrewdriverIcon, DocumentTextIcon,
  UserGroupIcon, CurrencyPoundIcon, ChartBarIcon,
  BellIcon, Cog6ToothIcon, BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useAuthStore } from '../../stores/authStore';
import { useNotifications } from '../../hooks/useDashboard';

const allNav = [
  { to: '/',              label: 'Dashboard',    icon: HomeIcon,                 roles: null },
  { to: '/tickets',       label: 'Tickets',      icon: WrenchScrewdriverIcon,    roles: null },
  { to: '/quotes',        label: 'Quotations',   icon: DocumentTextIcon,         roles: ['property_manager','property_owner','admin','contractor'] },
  { to: '/contractors',   label: 'Contractors',  icon: UserGroupIcon,            roles: ['property_manager','property_owner','admin'] },
  { to: '/payments',      label: 'Payments',     icon: CurrencyPoundIcon,        roles: ['property_manager','property_owner','admin'] },
  { to: '/reports',       label: 'Reports',      icon: ChartBarIcon,             roles: ['property_manager','property_owner','admin'] },
];

export default function Sidebar({ mobile = false, onClose }) {
  const { user, role } = useAuthStore();
  const { data: notifData } = useNotifications();
  const unread = notifData?.unread_count || 0;

  const nav = allNav.filter((n) => !n.roles || n.roles.includes(role));

  return (
    <aside className={clsx(
      'flex flex-col h-full bg-slate-900 text-white',
      mobile ? 'w-full' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
          <BuildingOfficeIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm leading-tight">HouseManager</p>
          <p className="text-xs text-slate-400">Property Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={mobile ? onClose : undefined}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon className="w-4.5 h-4.5 w-5 h-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-700/50 space-y-0.5">
        <NavLink
          to="/notifications"
          onClick={mobile ? onClose : undefined}
          className={({ isActive }) => clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isActive
              ? 'bg-brand-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          )}
        >
          <div className="relative">
            <BellIcon className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
          Notifications
        </NavLink>
        <NavLink
          to="/settings"
          onClick={mobile ? onClose : undefined}
          className={({ isActive }) => clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isActive
              ? 'bg-brand-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          )}
        >
          <Cog6ToothIcon className="w-5 h-5" />
          Settings
        </NavLink>

        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-3 mt-2 rounded-lg bg-slate-800">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
            {user?.profile?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.profile?.full_name}</p>
            <p className="text-xs text-slate-400 capitalize">{role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
