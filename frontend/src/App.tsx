import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { AuthPages } from './pages/AuthPages.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { CustomersPage } from './pages/CustomersPage.tsx';
import { ProductsPage } from './pages/ProductsPage.tsx';
import { PlansPage } from './pages/PlansPage.tsx';
import { QuotationTemplatesPage } from './pages/QuotationTemplatesPage.tsx';
import { SubscriptionsPage } from './pages/SubscriptionsPage.tsx';
import { InvoicesPage } from './pages/InvoicesPage.tsx';
import { PaymentsPage } from './pages/PaymentsPage.tsx';
import { TaxesPage } from './pages/TaxesPage.tsx';
import { DiscountsPage } from './pages/DiscountsPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { StaffManagementPage } from './pages/StaffManagementPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { UserRole } from './types/index.ts';

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-400">Verifying Brightloop security session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPages />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="templates" element={<QuotationTemplatesPage />} />
              <Route path="subscriptions" element={<SubscriptionsPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route
                path="taxes"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <TaxesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="discounts"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <DiscountsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'INTERNAL_STAFF']}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="staff"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <StaffManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
