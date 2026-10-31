import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { adjustPriceForVariant, getVariantSurcharge } from '../lib/pricing.ts';
import {
  Subscription,
  Customer,
  Product,
  SubscriptionPlan,
  Tax,
  Discount,
  QuotationTemplate,
  SubscriptionStatus,
  PaymentTerms
} from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import {
  Repeat,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Play,
  Pause,
  RefreshCw,
  XCircle,
  FileText,
  Layers,
  ChevronRight,
  X,
  PlusCircle,
  Trash2,
  Calendar,
  Building2,
  History,
  Send,
  Sparkles
} from 'lucide-react';

export const SubscriptionsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const [searchParams] = useSearchParams();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Drawer / Detail modal
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  // New Subscription Form Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [planId, setPlanId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('NET_30');
  const [selectedTaxIds, setSelectedTaxIds] = useState<string[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>('');
  const [initialStatus, setInitialStatus] = useState<SubscriptionStatus>('DRAFT');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<{
    productId: string;
    variantId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[]>([]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [subsRes, custsRes, prodsRes, plansRes, taxesRes, discsRes, tmplsRes] = await Promise.all([
        api.get<Subscription[]>('/subscriptions'),
        api.get<Customer[]>('/customers'),
        api.get<Product[]>('/products'),
        api.get<SubscriptionPlan[]>('/plans'),
        api.get<Tax[]>('/taxes'),
        api.get<Discount[]>('/discounts'),
        api.get<QuotationTemplate[]>('/quotation-templates')
      ]);

      setSubscriptions(subsRes);
      setCustomers(custsRes);
      setProducts(prodsRes);
      setPlans(plansRes);
      setTaxes(taxesRes);
      setSelectedTaxIds(current => current.length > 0
        ? current
        : [taxesRes.find(tax => tax.status === 'ACTIVE')?.id].filter((id): id is string => Boolean(id)));
      setDiscounts(discsRes);
      setTemplates(tmplsRes);

      // Check if template requested via URL query param
      const tmplParam = searchParams.get('createWithTemplate');
      if (tmplParam) {
        const tmpl = tmplsRes.find(t => t.id === tmplParam);
        if (tmpl) {
          applyTemplateToForm(tmpl, prodsRes, plansRes, custsRes);
        }
      }
    } catch (err: any) {
      error(err.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const applyTemplateToForm = (
    tmpl: QuotationTemplate,
    prods: Product[],
    plns: SubscriptionPlan[],
    custs: Customer[]
  ) => {
    setSelectedTemplateId(tmpl.id);
    if (tmpl.planId) setPlanId(tmpl.planId);
    if (tmpl.taxIds) setSelectedTaxIds(tmpl.taxIds);
    if (tmpl.discountId) setSelectedDiscountId(tmpl.discountId);
    if (custs.length > 0 && !customerId) {
      setCustomerId(custs[0].id);
    }

    const newLines = tmpl.lines.map(l => {
      const prod = prods.find(p => p.id === l.productId);
      const variant = prod?.variants.find(v => v.id === l.variantId);
      return {
        productId: l.productId,
        variantId: l.variantId,
        description: `${prod?.name || 'Item'} (${variant?.name || 'Default'})`,
        quantity: l.quantity,
        unitPrice: l.unitPrice
      };
    });
    setLines(newLines);
    setInitialStatus('QUOTATION');
    setIsCreateModalOpen(true);
  };

  const openNewSubscriptionModal = () => {
    setSelectedTemplateId('');
    setCustomerId(customers[0]?.id || '');
    const firstPlan = plans.find(plan => plan.status === 'ACTIVE');
    setPlanId(firstPlan?.id || '');
    setStartDate(new Date().toISOString().split('T')[0]);
    setPaymentTerms('NET_30');
    setSelectedTaxIds([taxes.find(tax => tax.status === 'ACTIVE')?.id].filter((id): id is string => Boolean(id)));
    setSelectedDiscountId('');
    setInitialStatus(user?.role === 'CUSTOMER' ? 'QUOTATION' : 'DRAFT');
    setNotes('');

    // Default line from product
    const firstProd = products.find(product => product.id === firstPlan?.productId && product.status === 'ACTIVE');
    const firstVariant = firstProd?.variants.find(variant => variant.status === 'ACTIVE');
    setLines([
      {
        productId: firstProd?.id || '',
        variantId: firstVariant?.id,
        description: firstProd ? `${firstProd.name} (${firstPlan?.name || 'Monthly'})` : 'Subscription Line Item',
        quantity: 1,
        unitPrice: (firstPlan?.billingPrice ?? firstProd?.baseSalesPrice ?? 0) + getVariantSurcharge(firstProd, firstVariant?.id)
      }
    ]);
    setIsCreateModalOpen(true);
  };

  const handleTemplateSelectionChange = (tId: string) => {
    setSelectedTemplateId(tId);
    if (!tId) return;
    const tmpl = templates.find(t => t.id === tId);
    if (tmpl) {
      applyTemplateToForm(tmpl, products, plans, customers);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        customerId: user?.role === 'CUSTOMER' ? user.customerId : customerId,
        planId,
        startDate,
        paymentTerms,
        taxIds: selectedTaxIds,
        discountId: selectedDiscountId || undefined,
        status: initialStatus,
        notes,
        lines
      };

      const res = await api.post<Subscription>('/subscriptions', payload);
      success(`Subscription ${res.subscriptionNumber} established successfully.`);
      setIsCreateModalOpen(false);
      fetchAllData();
    } catch (err: any) {
      error(err.message || 'Failed to create subscription');
    }
  };

  const handleTransition = async (subId: string, targetStatus: string, actionNotes?: string) => {
    try {
      const res: any = await api.post(`/subscriptions/${subId}/transition`, {
        targetStatus,
        actionNotes
      });
      success(res.message || `Status updated to ${targetStatus}`);
      setSelectedSub(res.subscription);
      fetchAllData();
    } catch (err: any) {
      error(err.message || 'Status transition failed');
    }
  };

  // Live price calculation for modal
  const modalSubtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const selectedDiscountObj = discounts.find(d => d.id === selectedDiscountId);
  let modalDiscountAmount = 0;
  if (selectedDiscountObj) {
    modalDiscountAmount =
      selectedDiscountObj.type === 'PERCENTAGE'
        ? (modalSubtotal * selectedDiscountObj.value) / 100
        : Math.min(selectedDiscountObj.value, modalSubtotal);
  }
  const modalNet = Math.max(0, modalSubtotal - modalDiscountAmount);
  let modalTaxAmount = 0;
  for (const tid of selectedTaxIds) {
    const t = taxes.find(tx => tx.id === tid);
    if (t) modalTaxAmount += (modalNet * t.rate) / 100;
  }
  const modalTotal = modalNet + modalTaxAmount;

  const filteredSubs = subscriptions.filter(s => {
    const cust = customers.find(c => c.id === s.customerId);
    const matchesSearch =
      s.subscriptionNumber.toLowerCase().includes(search.toLowerCase()) ||
      (cust?.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
      (cust?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Subscriptions & Quotations</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage contract lifecycles: Draft &rarr; Quotation &rarr; Confirmed &rarr; Active &rarr; Closed.
          </p>
        </div>
        <button
          onClick={openNewSubscriptionModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          {user?.role === 'CUSTOMER' ? 'Subscribe to a Service' : 'Create Subscription / Quotation'}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by subscription #, company, or customer..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
          {['ALL', 'DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === st ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Subscription Ref</th>
                <th className="py-3.5 px-5">Customer Account</th>
                <th className="py-3.5 px-5">Plan & Frequency</th>
                <th className="py-3.5 px-5">Next Billing</th>
                <th className="py-3.5 px-5">Amount</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Loading subscriptions...
                  </td>
                </tr>
              ) : filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                filteredSubs.map(sub => {
                  const cust = customers.find(c => c.id === sub.customerId);
                  const plan = plans.find(p => p.id === sub.planId);

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {sub.subscriptionNumber}
                          </span>
                          {sub.isPaused && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              PAUSED
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">Terms: {sub.paymentTerms}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-slate-800">{cust?.companyName || cust?.name || 'Customer'}</p>
                        <p className="text-[11px] text-slate-400">{cust?.email}</p>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-semibold text-slate-700">{plan?.name || 'Custom Plan'}</p>
                        <span className="text-[10px] uppercase font-bold text-indigo-600">
                          {plan?.billingFrequency || 'MONTHLY'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-mono text-slate-800">{sub.nextBillingDate}</p>
                        <span className="text-[10px] text-slate-400">Start: {sub.startDate}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-slate-900">₹{sub.totalAmount.toLocaleString()}</p>
                        {sub.discountAmount > 0 && (
                          <span className="text-[10px] text-emerald-600">Save ₹{sub.discountAmount}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <Badge status={sub.status} />
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setSelectedSub(sub)}
                          className="px-3 py-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-semibold text-xs transition-colors"
                        >
                          Manage &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Detail & Lifecycle Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-base font-black text-slate-900">
                    {selectedSub.subscriptionNumber}
                  </span>
                  <Badge status={selectedSub.status} />
                  {selectedSub.isPaused && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                      PAUSED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Customer: {customers.find(c => c.id === selectedSub.customerId)?.companyName} • Plan: {plans.find(p => p.id === selectedSub.planId)?.name}
                </p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lifecycle Status Action Bar */}
            <div className="my-4 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Workflow Transitions & Actions
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {/* Draft -> Quotation */}
                {selectedSub.status === 'DRAFT' && user?.role !== 'CUSTOMER' && (
                  <button
                    onClick={() => handleTransition(selectedSub.id, 'QUOTATION', 'Converted draft to official quotation')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" /> Issue Quotation
                  </button>
                )}

                {/* Quotation -> Confirmed */}
                {selectedSub.status === 'QUOTATION' && (
                  <button
                    onClick={() => handleTransition(selectedSub.id, 'CONFIRMED', 'Customer confirmed quotation contract terms')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Confirm Quotation
                  </button>
                )}

                {/* Confirmed -> Active */}
                {selectedSub.status === 'CONFIRMED' && user?.role !== 'CUSTOMER' && (
                  <button
                    onClick={() => handleTransition(selectedSub.id, 'ACTIVE', 'Subscription verified & activated')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5" /> Activate Subscription
                  </button>
                )}

                {/* Active -> Pause / Resume */}
                {selectedSub.status === 'ACTIVE' && (
                  <>
                    {!selectedSub.isPaused ? (
                      <button
                        onClick={() => handleTransition(selectedSub.id, 'PAUSED', 'Customer requested temporary hold')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                      >
                        <Pause className="w-3.5 h-3.5" /> Pause Subscription
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTransition(selectedSub.id, 'RESUME', 'Subscription resumed')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5" /> Resume Subscription
                      </button>
                    )}

                    <button
                      onClick={() => handleTransition(selectedSub.id, 'RENEW', 'Contract renewed for next term')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Renew Contract
                    </button>
                  </>
                )}

                {/* Close Subscription */}
                {selectedSub.status !== 'CLOSED' && (
                  <button
                    onClick={() => handleTransition(selectedSub.id, 'CLOSED', 'Subscription contract terminated')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all ml-auto"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Close Subscription
                  </button>
                )}
              </div>
            </div>

            {/* Financial Summary & Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Subtotal</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">₹{selectedSub.subtotal.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Discount</span>
                <p className="text-sm font-bold text-emerald-600 mt-0.5">-₹{selectedSub.discountAmount.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400">Taxes</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">+₹{selectedSub.taxAmount.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100">
                <span className="text-[10px] uppercase font-bold text-indigo-600">Total Recurring</span>
                <p className="text-base font-black text-indigo-900 mt-0.5">₹{selectedSub.totalAmount.toLocaleString()}</p>
              </div>
            </div>

            {/* Line Items List */}
            <div className="my-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Contract Line Items</h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {selectedSub.lines.map(line => (
                  <div key={line.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-800">{line.description}</p>
                      <p className="text-[11px] text-slate-400">
                        Qty: {line.quantity} × ₹{line.unitPrice.toLocaleString()}
                      </p>
                    </div>
                    <span className="font-bold text-slate-900">₹{line.lineTotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Complete Audit History Log */}
            <div className="my-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-600" /> Complete Audit & Lifecycle Trail
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedSub.history.map((h, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{h.action}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      By: <span className="font-semibold text-slate-700">{h.performedBy}</span>
                      {h.notes ? ` • "${h.notes}"` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedSub(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Subscription / Quotation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {user?.role === 'CUSTOMER' ? 'Request Subscription Contract' : 'Create Subscription or Quotation'}
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} className="py-4 space-y-4 text-xs">
              {/* Optional Template Quick-loader */}
              {user?.role !== 'CUSTOMER' && (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-indigo-900">Load from Quotation Template:</span>
                  </div>
                  <select
                    value={selectedTemplateId}
                    onChange={e => handleTemplateSelectionChange(e.target.value)}
                    className="px-2.5 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white text-indigo-950 font-medium"
                  >
                    <option value="">Start from scratch</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.validityDurationDays}d)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Customer & Plan */}
              <div className="grid grid-cols-2 gap-3">
                {user?.role !== 'CUSTOMER' ? (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Customer Entity *
                    </label>
                    <select
                      value={customerId}
                      onChange={e => setCustomerId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                      required
                    >
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} ({c.name})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Subscribing Account
                    </label>
                    <input
                      type="text"
                      disabled
                      value={user?.company || user?.name || ''}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Subscription Plan *
                  </label>
                  <select
                    value={planId}
                    onChange={e => {
                      const pId = e.target.value;
                      setPlanId(pId);
                      const p = plans.find(pl => pl.id === pId);
                      if (p && lines.length > 0) {
                        const updated = [...lines];
                        const product = products.find(candidate => candidate.id === p.productId && candidate.status === 'ACTIVE');
                        const existingVariant = product?.variants.find(
                          variant => variant.id === updated[0].variantId && variant.status === 'ACTIVE'
                        );
                        const nextVariant = existingVariant || product?.variants.find(variant => variant.status === 'ACTIVE');
                        updated[0].productId = p.productId;
                        updated[0].variantId = nextVariant?.id;
                        updated[0].description = product ? `${product.name} (${p.name})` : p.name;
                        updated[0].unitPrice = p.billingPrice + getVariantSurcharge(product, updated[0].variantId);
                        setLines(updated);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                    required
                  >
                    {plans.filter(plan => plan.status === 'ACTIVE').map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.billingPrice}/{p.billingFrequency.toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates & Payment Terms */}
              <div className="grid grid-cols-3 gap-3">
                {user?.role !== 'CUSTOMER' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Contract Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Payment Terms
                      </label>
                      <select
                        value={paymentTerms}
                        onChange={e => setPaymentTerms(e.target.value as PaymentTerms)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                      >
                        <option value="IMMEDIATE">Due on Receipt (Immediate)</option>
                        <option value="NET_15">Net 15 Days</option>
                        <option value="NET_30">Net 30 Days</option>
                        <option value="NET_60">Net 60 Days</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Initial Status
                      </label>
                      <select
                        value={initialStatus}
                        onChange={e => setInitialStatus(e.target.value as SubscriptionStatus)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="QUOTATION">Quotation</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="ACTIVE">Active (Direct Billing)</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Multi-Line Product Items */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" /> Subscription Products & Quantities
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const firstProd = products.find(product => product.status === 'ACTIVE');
                      const firstVariant = firstProd?.variants.find(variant => variant.status === 'ACTIVE');
                      setLines([
                        ...lines,
                        {
                          productId: firstProd?.id || '',
                          variantId: firstVariant?.id,
                          description: `${firstProd?.name || 'Product'} (${firstVariant?.name || 'Standard'})`,
                          quantity: 1,
                          unitPrice: (firstProd?.baseSalesPrice ?? 0) + getVariantSurcharge(firstProd, firstVariant?.id)
                        }
                      ]);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Line
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {lines.map((l, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Item Description</label>
                        <input
                          type="text"
                          required
                          value={l.description}
                          onChange={e => {
                            const updated = [...lines];
                            updated[idx].description = e.target.value;
                            setLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Product</label>
                        <select
                          value={l.productId}
                          onChange={event => {
                            const product = products.find(candidate => candidate.id === event.target.value);
                            const variant = product?.variants.find(candidate => candidate.status === 'ACTIVE');
                            const selectedPlan = plans.find(candidate => candidate.id === planId);
                            const basePrice = selectedPlan && selectedPlan.productId === product?.id
                              ? selectedPlan.billingPrice
                              : product?.baseSalesPrice ?? 0;
                            const updated = [...lines];
                            updated[idx] = {
                              ...updated[idx],
                              productId: product?.id || '',
                              variantId: variant?.id,
                              description: `${product?.name || 'Product'} (${variant?.name || 'Standard'})`,
                              unitPrice: basePrice + getVariantSurcharge(product, variant?.id)
                            };
                            setLines(updated);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                          required
                        >
                          {products.filter(product => product.status === 'ACTIVE').map(product => (
                            <option key={product.id} value={product.id}>{product.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Variant</label>
                        <select
                          value={l.variantId || ''}
                          onChange={event => {
                            const product = products.find(candidate => candidate.id === l.productId);
                            const nextVariantId = event.target.value || undefined;
                            const updated = [...lines];
                            updated[idx].unitPrice = adjustPriceForVariant(
                              updated[idx].unitPrice,
                              product,
                              updated[idx].variantId,
                              nextVariantId
                            );
                            updated[idx].variantId = nextVariantId;
                            setLines(updated);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        >
                          <option value="">No variant</option>
                          {products.find(product => product.id === l.productId)?.variants
                            .filter(variant => variant.status === 'ACTIVE')
                            .map(variant => (
                              <option key={variant.id} value={variant.id}>
                                {variant.name} (+₹{variant.additionalPrice})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={l.quantity}
                          onChange={e => {
                            const updated = [...lines];
                            updated[idx].quantity = parseInt(e.target.value, 10) || 1;
                            setLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Unit Price (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={l.unitPrice}
                          onChange={e => {
                            const updated = [...lines];
                            updated[idx].unitPrice = parseFloat(e.target.value) || 0;
                            setLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-1 text-center pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (lines.length <= 1) {
                              info('At least one line item is required.');
                              return;
                            }
                            setLines(lines.filter((_, i) => i !== idx));
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax & Discount selectors */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Apply Discount Coupon
                  </label>
                  <select
                    value={selectedDiscountId}
                    onChange={e => setSelectedDiscountId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="">No Discount</option>
                    {discounts.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {d.name} ({d.type === 'PERCENTAGE' ? `${d.value}%` : `₹${d.value}`})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Applicable Tax Rules
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {taxes.map(t => (
                      <label key={t.id} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTaxIds.includes(t.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedTaxIds([...selectedTaxIds, t.id]);
                            else setSelectedTaxIds(selectedTaxIds.filter(id => id !== t.id));
                          }}
                          className="w-3.5 h-3.5 text-indigo-600 rounded"
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Totals Card */}
              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Estimated Total (Taxes & Discounts Incl.)</span>
                  <p className="text-xl font-black text-white">₹{modalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right text-[11px] text-slate-300">
                  <p>Subtotal: ₹{modalSubtotal.toLocaleString()}</p>
                  <p>Tax: ₹{modalTaxAmount.toFixed(2)}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                >
                  Confirm & Create Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
