import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { SubscriptionPlan, Product, BillingFrequency } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Settings2,
  ChevronRight,
  X,
  Sparkles,
  Repeat
} from 'lucide-react';

export const PlansPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [freqFilter, setFreqFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: '',
    productId: '',
    billingPrice: 0,
    billingFrequency: 'MONTHLY' as BillingFrequency,
    minQuantity: 1,
    availableFrom: new Date().toISOString().split('T')[0],
    availableUntil: `${new Date().getUTCFullYear() + 2}-12-31`,
    autoCloseDays: 30,
    allowPause: true,
    allowEarlyClosure: true,
    allowRenewal: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, prodsRes] = await Promise.all([
        api.get<SubscriptionPlan[]>('/plans'),
        api.get<Product[]>('/products')
      ]);
      setPlans(plansRes);
      setProducts(prodsRes);
      if (prodsRes.length > 0 && !formData.productId) {
        setFormData(prev => ({ ...prev, productId: prodsRes[0].id }));
      }
    } catch (err: any) {
      error(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      productId: products[0]?.id || '',
      billingPrice: 0,
      billingFrequency: 'MONTHLY',
      minQuantity: 1,
      availableFrom: new Date().toISOString().split('T')[0],
      availableUntil: `${new Date().getUTCFullYear() + 2}-12-31`,
      autoCloseDays: 30,
      allowPause: true,
      allowEarlyClosure: true,
      allowRenewal: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: SubscriptionPlan) => {
    setEditingPlan(p);
    setFormData({
      name: p.name,
      productId: p.productId,
      billingPrice: p.billingPrice,
      billingFrequency: p.billingFrequency,
      minQuantity: p.minQuantity,
      availableFrom: p.availableFrom,
      availableUntil: p.availableUntil,
      autoCloseDays: p.autoCloseDays,
      allowPause: p.allowPause,
      allowEarlyClosure: p.allowEarlyClosure,
      allowRenewal: p.allowRenewal
    });
    setIsModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPlan) {
        await api.put(`/plans/${editingPlan.id}`, formData);
        success('Subscription plan updated');
      } else {
        await api.post('/plans', formData);
        success('New subscription plan established');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save plan');
    }
  };

  const toggleStatus = async (plan: SubscriptionPlan) => {
    try {
      const nextStatus = plan.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.put(`/plans/${plan.id}`, { status: nextStatus });
      success(`Plan marked as ${nextStatus}`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to toggle status');
    }
  };

  const filtered = plans.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesFreq = freqFilter === 'ALL' || p.billingFrequency === freqFilter;
    return matchesSearch && matchesFreq;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Subscription Plans & Billing Intervals</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Define recurring billing frequencies, minimum order seats, pause permissions, and renewal policies.
          </p>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> Create Subscription Plan
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search plans by name..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
          {['ALL', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].map(f => (
            <button
              key={f}
              onClick={() => setFreqFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                freqFilter === f ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">Loading plans...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">No subscription plans found.</div>
        ) : (
          filtered.map(plan => {
            const product = products.find(p => p.id === plan.productId);
            return (
              <div
                key={plan.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between shadow-sm hover:border-indigo-200 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {plan.billingFrequency}
                    </span>
                    <Badge status={plan.status} />
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mt-3 tracking-tight group-hover:text-indigo-600 transition-colors">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Product: {product?.name || 'Brightloop Cloud Service'}</p>

                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-baseline justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Recurring Rate</p>
                      <p className="text-2xl font-black text-slate-900">
                        ₹{plan.billingPrice.toLocaleString()}
                        <span className="text-xs font-normal text-slate-500">/{plan.billingFrequency.toLowerCase()}</span>
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">Min: {plan.minQuantity} qty</span>
                  </div>

                  {/* Permissions & Features */}
                  <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Customer Pause Permission:</span>
                      <span className="font-semibold">{plan.allowPause ? 'Allowed' : 'Disabled'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Early Termination Allowed:</span>
                      <span className="font-semibold">{plan.allowEarlyClosure ? 'Yes' : 'Restricted'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Auto-Renewal:</span>
                      <span className="font-semibold">{plan.allowRenewal ? 'Automatic' : 'Manual'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500">Auto-close grace period:</span>
                      <span className="font-semibold">{plan.autoCloseDays} days</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Available: {plan.availableFrom} to {plan.availableUntil}</span>
                  {user?.role === 'SUPER_ADMIN' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(plan)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleStatus(plan)}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        {plan.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => navigate('/subscriptions')}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 shadow-xs"
                    >
                      Subscribe &rarr;
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Plan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Accounting Cloud - Annual Scale"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Associated Product *
                  </label>
                  <select
                    value={formData.productId}
                    onChange={e => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Billing Frequency *
                  </label>
                  <select
                    value={formData.billingFrequency}
                    onChange={e => setFormData({ ...formData, billingFrequency: e.target.value as BillingFrequency })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Billing Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.billingPrice}
                    onChange={e => setFormData({ ...formData, billingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Minimum Quantity / Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minQuantity}
                    onChange={e => setFormData({ ...formData, minQuantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Available From
                  </label>
                  <input
                    type="date"
                    value={formData.availableFrom}
                    onChange={e => setFormData({ ...formData, availableFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Available Until
                  </label>
                  <input
                    type="date"
                    value={formData.availableUntil}
                    onChange={e => setFormData({ ...formData, availableUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Lifecycle Permissions</p>
                <div className="flex items-center justify-between">
                  <span>Allow Customer to Pause Subscription</span>
                  <input
                    type="checkbox"
                    checked={formData.allowPause}
                    onChange={e => setFormData({ ...formData, allowPause: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Allow Early Cancellation</span>
                  <input
                    type="checkbox"
                    checked={formData.allowEarlyClosure}
                    onChange={e => setFormData({ ...formData, allowEarlyClosure: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span>Allow Manual Renewal</span>
                  <input
                    type="checkbox"
                    checked={formData.allowRenewal}
                    onChange={e => setFormData({ ...formData, allowRenewal: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>
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
                  {editingPlan ? 'Save Plan' : 'Establish Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
