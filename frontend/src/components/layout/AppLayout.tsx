import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { Header } from './Header.tsx';

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/customers')) return 'Customer Directory';
    if (path.startsWith('/products')) return 'Product & Variant Catalog';
    if (path.startsWith('/plans')) return 'Subscription Plans';
    if (path.startsWith('/templates')) return 'Quotation Templates';
    if (path.startsWith('/subscriptions')) return 'Subscription Contracts & Quotations';
    if (path.startsWith('/taxes')) return 'Tax Configuration Rules';
    if (path.startsWith('/discounts')) return 'Discount & Coupon Engine';
    if (path.startsWith('/invoices')) return 'Invoices & Recurring Billing';
    if (path.startsWith('/payments')) return 'Payment Reconciliation';
    if (path.startsWith('/reports')) return 'Financial Reports & Analytics';
    if (path.startsWith('/staff')) return 'Staff Access Management';
    if (path.startsWith('/profile')) return 'Account Profile & Security';
    return 'Executive Dashboard';
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header onToggleSidebar={() => setCollapsed(!collapsed)} pageTitle={getPageTitle()} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
