import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../lib/api.ts';
import { Badge } from '../components/ui/Badge.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Link } from 'react-router-dom';
import {
  Users,
  Repeat,
  TrendingUp,
  AlertTriangle,
  FileText,
  DollarSign,
  Calendar,
  CreditCard,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Clock,
  ExternalLink,
  Download
} from 'lucide-react';
import { generateInvoicePDF } from '../lib/pdfGenerator.ts';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { error } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard');
      setData(res);
    } catch (err: any) {
      error(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoicePDF = async (invId: string) => {
    try {
      const res: any = await api.get(`/invoices/${invId}`);
      if (res && res.invoice) {
        generateInvoicePDF(res.invoice, res.customer, res.payments || []);
      }
    } catch (err: any) {
      error(err.message || 'Failed to download invoice PDF');
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const handleUpdate = () => fetchDashboardData();
    window.addEventListener('billing-cycle-completed', handleUpdate);
    return () => window.removeEventListener('billing-cycle-completed', handleUpdate);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading financial metrics & subscription data...</p>
        </div>
      </div>
    );
  }

  // CUSTOMER DASHBOARD VIEW
  if (data.customerView) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider border border-indigo-500/30">
              Customer Portal
            </span>
            <h2 className="text-2xl font-black mt-2 tracking-tight">Welcome back, {user?.name}!</h2>
            <p className="text-sm text-slate-300 mt-1">
              Manage your active Brightloop software subscriptions, review billing history, and pay invoices.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/subscriptions"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
            >
              <Repeat className="w-4 h-4" /> My Subscriptions
            </Link>
            <Link
              to="/invoices"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" /> View Invoices
            </Link>
          </div>
        </div>

        {/* Customer KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Active Subscriptions</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{data.activeSubscriptionsCount}</h3>
            <p className="text-xs text-emerald-600 font-medium mt-1">Live cloud services</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Subscriptions</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{data.totalSubscriptionsCount}</h3>
            <p className="text-xs text-slate-400 mt-1">Contracts on file</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Outstanding Invoiced</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">₹{data.outstandingAmount?.toLocaleString()}</h3>
            <p className="text-xs text-slate-500 mt-1">Pending payments</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Payments Made</p>
            <h3 className="text-2xl font-bold text-indigo-600 mt-1">₹{data.totalPaidAmount?.toLocaleString()}</h3>
            <p className="text-xs text-emerald-600 font-medium mt-1">Settled securely</p>
          </div>
        </div>

        {/* Customer Recent Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Subscriptions */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-indigo-600" /> My Subscriptions
              </h3>
              <Link to="/subscriptions" className="text-xs text-indigo-600 hover:underline font-semibold">
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.recentSubscriptions?.length === 0 ? (
                <p className="p-6 text-xs text-slate-400 text-center">No subscriptions found</p>
              ) : (
                data.recentSubscriptions.map((sub: any) => (
                  <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">{sub.subscriptionNumber}</span>
                        <Badge status={sub.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Renewing: {sub.nextBillingDate} • Terms: {sub.paymentTerms}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">₹{sub.totalAmount.toLocaleString()}</p>
                      <Link to="/subscriptions" className="text-[11px] text-indigo-600 font-semibold hover:underline">
                        Details &rarr;
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" /> Recent Invoices
              </h3>
              <Link to="/invoices" className="text-xs text-indigo-600 hover:underline font-semibold">
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.recentInvoices?.length === 0 ? (
                <p className="p-6 text-xs text-slate-400 text-center">No invoices yet</p>
              ) : (
                data.recentInvoices.map((inv: any) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">{inv.invoiceNumber}</span>
                        <Badge status={inv.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Due: {inv.dueDate} • Outstanding: ₹{inv.outstandingAmount.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">₹{inv.totalAmount.toLocaleString()}</p>
                        <Link to="/invoices" className="text-[11px] text-indigo-600 font-semibold hover:underline">
                          View / Pay &rarr;
                        </Link>
                      </div>
                      <button
                        onClick={() => handleDownloadInvoicePDF(inv.id)}
                        className="p-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs transition-colors"
                        title="Download Invoice PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SUPER ADMIN & INTERNAL STAFF DASHBOARD
  const { kpis, charts, tables } = data;
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Overdue alert banner if any */}
      {kpis.overdueInvoicesCount > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                {kpis.overdueInvoicesCount} Overdue Invoices Detected (₹{kpis.overdueInvoicesAmount.toLocaleString()} Outstanding)
              </p>
              <p className="text-xs text-rose-700 mt-0.5">
                Customers have exceeded their credit due date. Follow up or record payments to maintain active service.
              </p>
            </div>
          </div>
          <Link
            to="/invoices"
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 shadow-sm"
          >
            Review Overdue &rarr;
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Monthly Recurring Revenue (MRR)</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-2">
            ₹{kpis.mrr.toLocaleString()}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Normalized across all active billing schedules
          </p>
        </div>

        {/* ARR */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Annual Run Rate (ARR)</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-2">
            ₹{kpis.arr.toLocaleString()}
          </h3>
          <p className="text-xs text-emerald-600 font-semibold mt-1">
            Annualized contract value
          </p>
        </div>

        {/* Revenue Collected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Cash Collected</span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-2">
            ₹{kpis.revenueReceived.toLocaleString()}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Actual verified payment transactions
          </p>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Outstanding Receivables</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600 mt-2">
            ₹{kpis.outstandingAmount.toLocaleString()}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Total invoiced awaiting collection
          </p>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active Subscriptions</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-2">{kpis.activeSubscriptions}</h3>
          <p className="text-xs text-slate-400 mt-1">Out of {kpis.totalSubscriptions} total contracts</p>
        </div>

        {/* Total Customers */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Enterprise Accounts</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-2">{kpis.totalCustomers}</h3>
          <p className="text-xs text-slate-400 mt-1">Active customer organizations</p>
        </div>

        {/* Total Invoiced Volume */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Invoiced Volume</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-2">
            ₹{kpis.invoicedRevenue.toLocaleString()}
          </h3>
          <p className="text-xs text-slate-400 mt-1">Confirmed & Paid invoices</p>
        </div>

        {/* Overdue Count */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Overdue Invoices</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-rose-600 mt-2">{kpis.overdueInvoicesCount}</h3>
          <p className="text-xs text-rose-600 font-semibold mt-1">Requires immediate follow-up</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Bar Chart (Invoiced vs Collected) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Revenue Performance</h3>
              <p className="text-xs text-slate-400">Invoiced Revenue vs Actual Cash Collected (₹)</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-600">
              Last 6 Months
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(val: any) => `₹${Number(val).toLocaleString()}`}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="invoiced" name="Invoiced Revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Cash Collected" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subscription Status Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Subscription Status Breakdown</h3>
              <p className="text-xs text-slate-400">Distribution across contract lifecycle</p>
            </div>
            <Link to="/subscriptions" className="text-xs font-semibold text-indigo-600 hover:underline">
              Manage &rarr;
            </Link>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.subscriptionStatusBreakdown}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  label={(entry: any) => `${entry.name}: ${entry.value ?? entry.count}`}
                  fontSize={11}
                >
                  {charts.subscriptionStatusBreakdown.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Subscriptions */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-indigo-600" /> Recent Subscriptions
            </h3>
            <Link to="/subscriptions" className="text-xs text-indigo-600 font-semibold hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {tables.recentSubscriptions?.map((sub: any) => (
              <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{sub.subscriptionNumber}</span>
                    <Badge status={sub.status} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-1">{sub.customerCompany || sub.customerName}</p>
                  <p className="text-[11px] text-slate-400">Plan: {sub.planName || 'Custom Suite'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">₹{sub.totalAmount.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">Next bill: {sub.nextBillingDate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" /> Recent Invoices
            </h3>
            <Link to="/invoices" className="text-xs text-indigo-600 font-semibold hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {tables.recentInvoices?.map((inv: any) => (
              <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{inv.invoiceNumber}</span>
                    <Badge status={inv.status} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-1">{inv.customerCompany || inv.customerName}</p>
                  <p className="text-[11px] text-slate-400">Due: {inv.dueDate}</p>
                </div>
                <div className="text-right flex items-center gap-2.5">
                  <div>
                    <p className="text-sm font-bold text-slate-900">₹{inv.totalAmount.toLocaleString()}</p>
                    <p className="text-[11px] font-medium text-amber-600">
                      {inv.outstandingAmount > 0 ? `Unpaid: ₹${inv.outstandingAmount.toLocaleString()}` : 'Settled'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownloadInvoicePDF(inv.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                    title="Download PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
