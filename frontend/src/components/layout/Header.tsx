import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';
import { api } from '../../lib/api.ts';
import {
  Menu,
  RefreshCw,
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  pageTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, pageTitle = 'Dashboard' }) => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [runningBilling, setRunningBilling] = useState(false);

  const handleRunRecurringBilling = async () => {
    try {
      setRunningBilling(true);
      const res: any = await api.post('/billing/run-recurring');
      success(res.message || 'Recurring billing cycle completed.');
      // Refresh page data if needed
      window.dispatchEvent(new CustomEvent('billing-cycle-completed'));
    } catch (err: any) {
      error(err.message || 'Failed to execute recurring billing cycle');
    } finally {
      setRunningBilling(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Brightloop /
          </span>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{pageTitle}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Trigger Recurring Billing Engine Button for Super Admin & Staff */}
        {user?.role !== 'CUSTOMER' && (
          <button
            onClick={handleRunRecurringBilling}
            disabled={runningBilling}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm"
            title="Scan active subscriptions and generate due invoices immediately"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningBilling ? 'animate-spin text-indigo-400' : 'text-emerald-400'}`} />
            <span className="hidden md:inline">Run Recurring Billing</span>
          </button>
        )}

        {/* User Info Avatar */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.name}</p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role?.replace('_', ' ').toLowerCase()}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
