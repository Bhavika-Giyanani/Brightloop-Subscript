import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  LayoutDashboard,
  Users,
  Package,
  CalendarDays,
  FileSpreadsheet,
  Repeat,
  Percent,
  Receipt,
  FileText,
  CreditCard,
  BarChart3,
  ShieldCheck,
  UserCheck,
  Building2,
  ChevronRight,
  LogOut,
  Layers
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { user, logout } = useAuth();
  const role = user?.role || 'CUSTOMER';

  const adminStaffLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/products', label: 'Products & Variants', icon: Package },
    { to: '/plans', label: 'Subscription Plans', icon: CalendarDays },
    { to: '/templates', label: 'Quotation Templates', icon: FileSpreadsheet },
    { to: '/subscriptions', label: 'Subscriptions', icon: Repeat },
    ...(role === 'SUPER_ADMIN'
      ? [
          { to: '/taxes', label: 'Tax Rules', icon: Receipt },
          { to: '/discounts', label: 'Discount Coupons', icon: Percent },
        ]
      : []),
    { to: '/invoices', label: 'Invoices & Billing', icon: FileText },
    { to: '/payments', label: 'Payments', icon: CreditCard },
    { to: '/reports', label: 'Financial Reports', icon: BarChart3 },
    ...(role === 'SUPER_ADMIN'
      ? [{ to: '/staff', label: 'Staff Management', icon: ShieldCheck }]
      : []),
    { to: '/profile', label: 'Profile & Settings', icon: UserCheck },
  ];

  const customerLinks = [
    { to: '/dashboard', label: 'Customer Portal', icon: LayoutDashboard },
    { to: '/subscriptions', label: 'My Subscriptions', icon: Repeat },
    { to: '/invoices', label: 'My Invoices', icon: FileText },
    { to: '/payments', label: 'Payment Receipts', icon: CreditCard },
    { to: '/plans', label: 'Explore Plans', icon: Layers },
    { to: '/profile', label: 'Account Profile', icon: UserCheck },
  ];

  const links = role === 'CUSTOMER' ? customerLinks : adminStaffLinks;

  return (
    <aside
      className={`bg-[#0B132B] text-slate-300 flex flex-col transition-all duration-300 ease-in-out shrink-0 z-30 border-r border-slate-800 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800/80 justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-lg shadow-md shrink-0 shadow-indigo-500/20">
            B
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base text-white tracking-tight leading-tight">
                Brightloop
              </span>
              <span className="text-[10px] uppercase font-semibold text-indigo-400 tracking-wider">
                Subscriptions Cloud
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Role Pill Banner */}
      {!collapsed && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="truncate">
                {role === 'SUPER_ADMIN'
                  ? 'Super Admin'
                  : role === 'INTERNAL_STAFF'
                  ? 'Internal Staff'
                  : 'Customer Portal'}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(link => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                } ${collapsed ? 'justify-center px-2' : ''}`
              }
              title={collapsed ? link.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-105" />
              {!collapsed && <span className="truncate">{link.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title="Sign out"
        >
          <LogOut className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-rose-400" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
