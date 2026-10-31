import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { Invoice, Customer, Payment, PaymentMethod } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { generateInvoicePDF } from '../lib/pdfGenerator.ts';
import {
  FileText,
  Search,
  Printer,
  Download,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Building2,
  Calendar,
  Receipt,
  QrCode,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export const InvoicesPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected Invoice for Full Corporate View & Print/PDF
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoicePayments, setInvoicePayments] = useState<Payment[]>([]);

  // Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const [invRes, custRes] = await Promise.all([
        api.get<Invoice[]>('/invoices'),
        api.get<Customer[]>('/customers')
      ]);
      setInvoices(invRes);
      setCustomers(custRes);
    } catch (err: any) {
      error(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    const handleUpdate = () => fetchInvoices();
    window.addEventListener('billing-cycle-completed', handleUpdate);
    return () => window.removeEventListener('billing-cycle-completed', handleUpdate);
  }, []);

  const openInvoiceDetail = async (inv: Invoice) => {
    setSelectedInvoice(inv);
    try {
      const res: any = await api.get(`/invoices/${inv.id}`);
      setInvoicePayments(res.payments || []);
    } catch {
      setInvoicePayments([]);
    }
  };

  const openPaymentModal = (inv: Invoice) => {
    setPayingInvoice(inv);
    setPayAmount(inv.outstandingAmount);
    setPayMethod('BANK_TRANSFER');
    setPayRef(`TXN-${Date.now().toString().slice(-6)}`);
    setPayNotes(`Payment for ${inv.invoiceNumber}`);
    setIsPayModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    try {
      const res: any = await api.post('/payments', {
        invoiceId: payingInvoice.id,
        amount: Number(payAmount),
        paymentMethod: payMethod,
        transactionReference: payRef,
        notes: payNotes
      });
      success(`Payment of ₹${payAmount.toLocaleString()} recorded. Status updated.`);
      setIsPayModalOpen(false);
      fetchInvoices();
      if (selectedInvoice && selectedInvoice.id === payingInvoice.id) {
        openInvoiceDetail(res.invoice);
      }
    } catch (err: any) {
      error(err.message || 'Payment processing failed');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await api.patch<Invoice>(`/invoices/${id}/status`, { status });
      success(`Invoice marked as ${status}`);
      fetchInvoices();
      if (selectedInvoice && selectedInvoice.id === id) {
        setSelectedInvoice(res);
      }
    } catch (err: any) {
      error(err.message || 'Failed to update invoice status');
    }
  };

  const handleDownloadPDF = async (inv: Invoice) => {
    try {
      const cust = customers.find(c => c.id === inv.customerId);
      let payments: Payment[] = [];
      try {
        const res: any = await api.get(`/invoices/${inv.id}`);
        payments = res.payments || [];
      } catch {
        payments = [];
      }
      generateInvoicePDF(inv, cust, payments);
      success(`Invoice ${inv.invoiceNumber} PDF downloaded successfully.`);
    } catch (err: any) {
      error(err.message || 'Failed to generate invoice PDF');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const filtered = invoices.filter(inv => {
    const cust = customers.find(c => c.id === inv.customerId);
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (cust?.companyName || '').toLowerCase().includes(search.toLowerCase());
    const isOverdue = inv.status === 'CONFIRMED' && inv.outstandingAmount > 0 && inv.dueDate < todayStr;
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'OVERDUE'
        ? isOverdue
        : inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Invoices & Billing Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated recurring invoice cycles, PDF print layouts, payment reconciliation, and overdue tracking.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 no-print">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by invoice # or company..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
          {['ALL', 'CONFIRMED', 'PAID', 'OVERDUE', 'CANCELLED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Invoice #</th>
                <th className="py-3.5 px-5">Customer Account</th>
                <th className="py-3.5 px-5">Billing Dates</th>
                <th className="py-3.5 px-5">Invoice Amount</th>
                <th className="py-3.5 px-5">Outstanding</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Loading billing invoices...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No invoices match the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map(inv => {
                  const cust = customers.find(c => c.id === inv.customerId);
                  const isOverdue = inv.status === 'CONFIRMED' && inv.outstandingAmount > 0 && inv.dueDate < todayStr;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {inv.invoiceNumber}
                          </span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 animate-pulse">
                              OVERDUE
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">Issued: {inv.invoiceDate}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-slate-800">{cust?.companyName || cust?.name || 'Customer'}</p>
                        <p className="text-[11px] text-slate-400">{cust?.email}</p>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-mono text-slate-700">Due: {inv.dueDate}</p>
                        <span className="text-[10px] text-slate-400">Period: {inv.billingPeriodStart} to {inv.billingPeriodEnd}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-slate-900">₹{inv.totalAmount.toLocaleString()}</p>
                        <span className="text-[10px] text-slate-400">Paid: ₹{inv.paidAmount.toLocaleString()}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className={`font-black ${inv.outstandingAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          ₹{inv.outstandingAmount.toLocaleString()}
                        </p>
                      </td>
                      <td className="py-3.5 px-5">
                        <Badge status={inv.status} />
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openInvoiceDetail(inv)}
                            className="px-2.5 py-1.5 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold text-xs transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(inv)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold text-xs transition-colors shadow-xs"
                            title="Download PDF Invoice"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                          {user?.role !== 'CUSTOMER' && inv.outstandingAmount > 0 && inv.status !== 'CANCELLED' && (
                            <button
                              onClick={() => openPaymentModal(inv)}
                              className="px-2.5 py-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold text-xs transition-colors flex items-center gap-1"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Invoice Full Corporate Letterhead / Print & PDF View Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-8 max-h-[92vh] overflow-y-auto print-card animate-in fade-in zoom-in-95 duration-150">
            {/* Top Toolbar (No-Print) */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-200 no-print">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice Document /</span>
                <span className="font-mono font-bold text-slate-900">{selectedInvoice.invoiceNumber}</span>
                <Badge status={selectedInvoice.status} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPDF(selectedInvoice)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                {user?.role !== 'CUSTOMER' && selectedInvoice.outstandingAmount > 0 && (
                  <button
                    onClick={() => openPaymentModal(selectedInvoice)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Record Payment
                  </button>
                )}
                {user?.role !== 'CUSTOMER' && selectedInvoice.status === 'CONFIRMED' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedInvoice.id, 'CANCELLED')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel Invoice
                  </button>
                )}
                <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-700 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Letterhead */}
            <div className="py-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
                      B
                    </div>
                    <span className="text-xl font-black text-slate-900 tracking-tight">Brightloop Software</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Brightloop Technologies Pvt Ltd<br />
                    Tower C, Cyber City, DLF Phase 2<br />
                    Gurugram, Haryana 122002, India<br />
                    GSTIN: 07AAACB2948F1Z1 • support@brightloop.io
                  </p>
                </div>

                <div className="text-right">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">TAX INVOICE</h1>
                  <p className="font-mono text-sm font-bold text-indigo-600 mt-1">{selectedInvoice.invoiceNumber}</p>
                  <p className="text-xs text-slate-500 mt-1">Invoice Date: <span className="font-semibold text-slate-800">{selectedInvoice.invoiceDate}</span></p>
                  <p className="text-xs text-slate-500">Payment Due: <span className="font-semibold text-rose-600">{selectedInvoice.dueDate}</span></p>
                </div>
              </div>

              {/* Bill To & Billing Period */}
              <div className="grid grid-cols-2 gap-6 mt-6 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">BILLED TO</p>
                  {(() => {
                    const cust = customers.find(c => c.id === selectedInvoice.customerId);
                    return (
                      <>
                        <p className="font-bold text-slate-900 text-sm">{cust?.companyName}</p>
                        <p className="text-slate-600 mt-0.5">Attn: {cust?.name}</p>
                        <p className="text-slate-500">{cust?.billingAddress}, {cust?.city} {cust?.country}</p>
                        <p className="text-slate-500">Email: {cust?.email}</p>
                        {cust?.taxNumber && <p className="font-mono text-slate-700 font-semibold mt-1">GST/TAX ID: {cust.taxNumber}</p>}
                      </>
                    );
                  })()}
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">SUBSCRIPTION DETAILS</p>
                  <p className="font-semibold text-slate-800">
                    Billing Cycle: {selectedInvoice.billingPeriodStart} to {selectedInvoice.billingPeriodEnd}
                  </p>
                  <p className="text-slate-500 mt-0.5">Ref: {selectedInvoice.subscriptionId || 'One-time Provisioning'}</p>
                  <div className="mt-2 inline-block">
                    <Badge status={selectedInvoice.status} size="md" />
                  </div>
                </div>
              </div>

              {/* Invoice Lines */}
              <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Item Description</th>
                      <th className="py-2.5 px-4 text-center">Qty</th>
                      <th className="py-2.5 px-4 text-right">Unit Price</th>
                      <th className="py-2.5 px-4 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInvoice.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="py-3 px-4 font-semibold text-slate-800">{l.description}</td>
                        <td className="py-3 px-4 text-center text-slate-600">{l.quantity}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">₹{l.unitPrice.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">₹{l.lineTotal.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="mt-6 flex justify-end">
                <div className="w-72 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-900">₹{selectedInvoice.subtotal.toLocaleString()}</span>
                  </div>

                  {selectedInvoice.discountBreakdown && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount ({selectedInvoice.discountBreakdown.code || 'Promo'}):</span>
                      <span className="font-mono font-semibold">-₹{selectedInvoice.discountBreakdown.amount.toLocaleString()}</span>
                    </div>
                  )}

                  {selectedInvoice.taxBreakdown.map((t, idx) => (
                    <div key={idx} className="flex justify-between text-slate-600">
                      <span>{t.taxName} ({t.rate}%):</span>
                      <span className="font-mono font-semibold text-slate-900">+₹{t.amount.toLocaleString()}</span>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                    <span>Invoice Total:</span>
                    <span className="font-mono text-base text-indigo-700">₹{selectedInvoice.totalAmount.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>Paid to Date:</span>
                    <span className="font-mono font-bold text-emerald-600">₹{selectedInvoice.paidAmount.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-sm font-bold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <span>Amount Outstanding:</span>
                    <span className="font-mono">₹{selectedInvoice.outstandingAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payments History table */}
              {invoicePayments.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Recorded Payment Receipts ({invoicePayments.length})
                  </p>
                  <div className="space-y-1.5 text-xs">
                    {invoicePayments.map(p => (
                      <div key={p.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800">{p.paymentNumber}</span> • {p.paymentMethod}
                          <p className="text-[11px] text-slate-400">Ref: {p.transactionReference} • {p.paymentDate}</p>
                        </div>
                        <span className="font-mono font-bold text-emerald-600">₹{p.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Bank & Tax Details */}
              <div className="mt-8 pt-4 border-t border-slate-200 grid grid-cols-2 text-[11px] text-slate-500">
                <div>
                  <p className="font-bold text-slate-700 uppercase">Payment Remittance Details</p>
                  <p>Contact your account administrator for bank transfer details.</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-700 uppercase">Terms & Conditions</p>
                  <p>Payment terms apply as agreed in subscription contract.</p>
                  <p>This is a computer-generated tax invoice and requires no physical signature.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPayModalOpen && payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Record Payment Receipt</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="py-4 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center text-slate-500 mb-1">
                  <span>Target Invoice:</span>
                  <span className="font-mono font-bold text-slate-900">{payingInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Current Outstanding Balance:</span>
                  <span className="font-mono font-black text-amber-600">₹{payingInvoice.outstandingAmount.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  max={payingInvoice.outstandingAmount}
                  value={payAmount}
                  onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports partial payments. Maximum allowed: ₹{payingInvoice.outstandingAmount.toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Payment Method *
                </label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                >
                  <option value="UPI">UPI Instant Pay</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/Wire)</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="CASH">Cash Deposit</option>
                  <option value="OTHER">Other Gateway</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Transaction Reference *
                </label>
                <input
                  type="text"
                  required
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="e.g. UTR-938201948 or CHQ-0012"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Internal Notes / Description
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="Reconciliation remark..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                >
                  Confirm & Settle Amount
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
