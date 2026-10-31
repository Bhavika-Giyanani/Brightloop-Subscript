import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { Customer, Invoice, Payment } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import {
  BarChart3,
  Calendar,
  Filter,
  Download,
  Printer,
  DollarSign,
  CreditCard,
  Receipt,
  Percent,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const { error } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCustomerId) params.append('customerId', selectedCustomerId);
      if (selectedStatus) params.append('status', selectedStatus);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const [repRes, custRes] = await Promise.all([
        api.get(`/reports?${params.toString()}`),
        api.get<Customer[]>('/customers')
      ]);

      setReportsData(repRes);
      setCustomers(custRes);
    } catch (err: any) {
      error(err.message || 'Failed to generate financial reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedCustomerId, selectedStatus, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Financial Reports & General Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit recognized revenue, cash collections, tax liabilities, and accounts receivable balances.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
        >
          <Printer className="w-4 h-4" /> Print Financial Statement
        </button>
      </div>

      {/* Filter Bar (No-Print) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm flex flex-wrap items-center gap-3 no-print text-xs">
        <div className="flex items-center gap-2 text-slate-500 font-semibold">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Filters:</span>
        </div>

        <div>
          <select
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 bg-white"
          >
            <option value="">All Customer Accounts</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 bg-white"
          >
            <option value="">All Invoice Statuses</option>
            <option value="CONFIRMED">Confirmed (Pending)</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 text-slate-600">
          <span>From:</span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="px-2 py-1.5 border border-slate-200 rounded-lg"
          />
        </div>

        <div className="flex items-center gap-1.5 text-slate-600">
          <span>To:</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="px-2 py-1.5 border border-slate-200 rounded-lg"
          />
        </div>

        {(selectedCustomerId || selectedStatus || startDate || endDate) && (
          <button
            onClick={() => {
              setSelectedCustomerId('');
              setSelectedStatus('');
              setStartDate('');
              setEndDate('');
            }}
            className="text-xs font-semibold text-rose-600 hover:underline ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {reportsData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Invoiced</span>
            <p className="text-xl font-black text-slate-900 mt-1">₹{reportsData.summary.totalInvoiced.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Gross recognized billings</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400">Cash Collections</span>
            <p className="text-xl font-black text-emerald-600 mt-1">₹{reportsData.summary.totalCollected.toLocaleString()}</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Realized bank remittances</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400">Net Receivables</span>
            <p className="text-xl font-black text-amber-600 mt-1">₹{reportsData.summary.netReceivables.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Awaiting customer clearance</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400">Tax Liabilities</span>
            <p className="text-xl font-black text-indigo-700 mt-1">₹{reportsData.summary.totalTaxes.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">GST/VAT collected for payout</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400">Discounts Conceded</span>
            <p className="text-xl font-black text-slate-700 mt-1">₹{reportsData.summary.totalDiscounts.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Promotional write-downs</p>
          </div>
        </div>
      )}

      {/* Invoices Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" /> Invoiced Ledger Entries
          </h3>
          <span className="text-xs text-slate-400 font-medium font-mono">
            {reportsData?.invoices?.length || 0} Records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">Invoice #</th>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Due Date</th>
                <th className="py-3 px-5">Subtotal</th>
                <th className="py-3 px-5">Taxes</th>
                <th className="py-3 px-5">Total</th>
                <th className="py-3 px-5">Outstanding</th>
                <th className="py-3 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">Loading report records...</td>
                </tr>
              ) : reportsData?.invoices?.map((inv: Invoice) => {
                const totalTax = (inv.taxBreakdown || []).reduce((s, t) => s + t.amount, 0);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="py-3 px-5 text-slate-600">{inv.invoiceDate}</td>
                    <td className="py-3 px-5 text-slate-600">{inv.dueDate}</td>
                    <td className="py-3 px-5 font-mono text-slate-800">₹{inv.subtotal.toLocaleString()}</td>
                    <td className="py-3 px-5 font-mono text-slate-600">₹{totalTax.toFixed(2)}</td>
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">₹{inv.totalAmount.toLocaleString()}</td>
                    <td className="py-3 px-5 font-mono font-bold text-amber-600">₹{inv.outstandingAmount.toLocaleString()}</td>
                    <td className="py-3 px-5">
                      <Badge status={inv.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
