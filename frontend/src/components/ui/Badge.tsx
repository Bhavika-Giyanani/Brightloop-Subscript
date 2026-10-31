import React from 'react';

export type StatusVariant =
  | 'DRAFT'
  | 'QUOTATION'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CLOSED'
  | 'PAID'
  | 'CANCELLED'
  | 'OVERDUE'
  | 'INACTIVE'
  | 'ARCHIVED';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'sm', className = '' }) => {
  const norm = status.toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  if (norm === 'ACTIVE' || norm === 'PAID' || norm === 'SUCCESS') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (norm === 'CONFIRMED') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (norm === 'QUOTATION') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (norm === 'DRAFT') {
    colorClasses = 'bg-slate-100 text-slate-600 border-slate-200';
  } else if (norm === 'PAUSED') {
    colorClasses = 'bg-orange-50 text-orange-700 border-orange-200';
  } else if (norm === 'OVERDUE') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-300 font-semibold animate-pulse';
  } else if (norm === 'CANCELLED' || norm === 'CLOSED' || norm === 'INACTIVE' || norm === 'ARCHIVED') {
    colorClasses = 'bg-slate-100 text-slate-500 border-slate-200 line-through-none';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${sizeClasses} ${colorClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 bg-current opacity-70" />
      {status}
    </span>
  );
};
