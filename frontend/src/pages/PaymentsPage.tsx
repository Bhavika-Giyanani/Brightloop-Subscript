import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { Payment, Invoice, Customer, PaymentMethod } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  CheckCircle,
  FileText,
  Building2,
  Calendar,
  X,
  ExternalLink,
  Receipt
} from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [payRes, invRes, custRes] = await Promise.all([
        api.get<Payment[]>('/payments'),
        api.get<Invoice[]>('/invoices'),
        api.get<Customer[]>('/customers')
      ]);
      setPayments(payRes);
      setInvoices(invRes);
      setCustomers(custRes);
    } catch (err: any) {
      error(err.message || 'Failed to load payments ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewPaymentModal = () => {
    // Pick first unpaid invoice
    const unpaid = invoices.filter(i => i.status === 'CONFIRMED' && i.outstandingAmount > 0);
    const first = unpaid[0];
    setSelectedInvoiceId(first?.id || '');
    setAmount(first?.outstandingAmount ?? 0);
    setPaymentMethod('BANK_TRANSFER');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setTransactionReference(`TXN-${Math.random().toString(36).substr(2, 8).toUpperCase()}`);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = invoices.find(i => i.id === invId);
    if (inv) {
      setAmount(inv.outstandingAmount);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) {
      error('Please select an invoice to apply payment to.');
      return;
    }
    const inv = invoices.find(i => i.id === selectedInvoiceId);
    if (!inv) {
      error('Selected invoice does not exist');
      return;
    }
    if (amount <= 0) {
      error('Payment amount must be greater than zero');
      return;
    }
    if (amount > inv.outstandingAmount + 0.01) {
      error(`Payment amount cannot exceed outstanding balance of ₹${inv.outstandingAmount.toFixed(2)}`);
      return;
    }

    try {
      await api.post('/payments', {
        invoiceId: selectedInvoiceId,
        amount: Number(amount),
        paymentMethod,
        paymentDate,
        transactionReference,
        notes
      });
      success(`Payment of ₹${amount.toLocaleString()} posted successfully`);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to record payment');
    }
  };

  const selectedInvObj = invoices.find(i => i.id === selectedInvoiceId);

  const filtered = payments.filter(p => {
    const cust = customers.find(c => c.id === p.customerId);
    const matchesSearch =
      p.paymentNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.transactionReference.toLowerCase().includes(search.toLowerCase()) ||
      (cust?.companyName || '').toLowerCase().includes(search.toLowerCase());
    const matchesMethod = methodFilter === 'ALL' || p.paymentMethod === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const totalCollected = filtered.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Payments & Receipts Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit verified payment remittances, UPI/wire references, and partial invoice reconciliations.
          </p>
        </div>
        {user?.role !== 'CUSTOMER' && (
          <button
            onClick={openNewPaymentModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> Record New Payment
          </button>
        )}
      </div>

      {/* Stats Quick Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Filtered Remittances</span>
            <p className="text-xl font-black text-slate-900">₹{totalCollected.toLocaleString()}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
          {filtered.length} Verified Transactions
        </span>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by payment #, txn ref, or client..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
          {['ALL', 'BANK_TRANSFER', 'UPI', 'CARD', 'CASH'].map(m => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                methodFilter === m ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Receipt #</th>
                <th className="py-3.5 px-5">Target Invoice</th>
                <th className="py-3.5 px-5">Customer Account</th>
                <th className="py-3.5 px-5">Method & Reference</th>
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-5">Amount</th>
                <th className="py-3.5 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Loading payments...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const cust = customers.find(c => c.id === p.customerId);
                  const inv = invoices.find(i => i.id === p.invoiceId);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-bold text-slate-900">{p.paymentNumber}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-bold text-indigo-600">{inv?.invoiceNumber || p.invoiceId}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-slate-800">{cust?.companyName || cust?.name || 'Customer'}</p>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-semibold text-slate-700">{p.paymentMethod.replace('_', ' ')}</p>
                        <p className="font-mono text-[11px] text-slate-400">{p.transactionReference}</p>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 font-mono">
                        {p.paymentDate}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-black text-emerald-600 text-sm">
                          ₹{p.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <Badge status={p.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Record Customer Payment</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Select Unpaid Invoice *
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={e => handleInvoiceChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                  required
                >
                  <option value="">-- Choose Invoice --</option>
                  {invoices
                    .filter(i => i.status !== 'CANCELLED' && i.outstandingAmount > 0)
                    .map(inv => {
                      const c = customers.find(cust => cust.id === inv.customerId);
                      return (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} - {c?.companyName} (Due: ₹{inv.outstandingAmount})
                        </option>
                      );
                    })}
                </select>
              </div>

              {selectedInvObj && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-center justify-between">
                  <span>Current Outstanding Balance:</span>
                  <span className="font-mono font-black text-sm">₹{selectedInvObj.outstandingAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Amount Paid (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="1"
                    max={selectedInvObj ? selectedInvObj.outstandingAmount : 9999999}
                    value={amount}
                    onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/Wire)</option>
                  <option value="UPI">UPI Instant Pay</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="CASH">Cash Deposit</option>
                  <option value="OTHER">Other Provider</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Transaction Reference ID *
                </label>
                <input
                  type="text"
                  required
                  value={transactionReference}
                  onChange={e => setTransactionReference(e.target.value)}
                  placeholder="e.g. UTR-293810293 or CHEQUE-9102"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Internal Reconciliation Note
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Verified by finance team"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                >
                  Post Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
