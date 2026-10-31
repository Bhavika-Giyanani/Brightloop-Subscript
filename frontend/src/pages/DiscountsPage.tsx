import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { Discount, Product, SubscriptionPlan } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import {
  Percent,
  Plus,
  Search,
  Tag,
  CheckCircle,
  X,
  Edit2,
  Sparkles,
  AlertCircle
} from 'lucide-react';

export const DiscountsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);

  // Live Coupon Tester
  const [testCode, setTestCode] = useState('');
  const [testSubtotal, setTestSubtotal] = useState<number>(0);
  const [testResult, setTestResult] = useState<any>(null);

  // Form
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    value: 0,
    minPurchaseAmount: 0,
    minQuantity: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: `${new Date().getUTCFullYear() + 2}-12-31`,
    maxUsageCount: 1
  });

  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const res = await api.get<Discount[]>('/discounts');
      setDiscounts(res);
    } catch (err: any) {
      error(err.message || 'Failed to load discounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const openCreate = () => {
    setEditingDiscount(null);
    setFormData({
      name: '',
      code: '',
      type: 'PERCENTAGE',
      value: 0,
      minPurchaseAmount: 0,
      minQuantity: 1,
      startDate: new Date().toISOString().split('T')[0],
      endDate: `${new Date().getUTCFullYear() + 2}-12-31`,
      maxUsageCount: 1
    });
    setIsModalOpen(true);
  };

  const openEdit = (d: Discount) => {
    setEditingDiscount(d);
    setFormData({
      name: d.name,
      code: d.code,
      type: d.type,
      value: d.value,
      minPurchaseAmount: d.minPurchaseAmount,
      minQuantity: d.minQuantity,
      startDate: d.startDate,
      endDate: d.endDate,
      maxUsageCount: d.maxUsageCount
    });
    setIsModalOpen(true);
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDiscount) {
        await api.put(`/discounts/${editingDiscount.id}`, formData);
        success('Discount updated');
      } else {
        await api.post('/discounts', formData);
        success('New discount coupon created');
      }
      setIsModalOpen(false);
      fetchDiscounts();
    } catch (err: any) {
      error(err.message || 'Failed to save discount');
    }
  };

  const handleTestCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testCode) return;
    try {
      const res: any = await api.post('/discounts/validate', {
        code: testCode,
        subtotal: testSubtotal,
        quantity: 1
      });
      setTestResult({ success: true, ...res });
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Validation failed' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Discounts & Coupon Engine</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create percentage or flat promotions, usage caps, and minimum spend eligibility rules.
          </p>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> Create Discount Rule
          </button>
        )}
      </div>

      {/* Live Coupon Validation Simulator Box */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Live Coupon Eligibility Tester
          </h3>
        </div>
        <form onSubmit={handleTestCoupon} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={testCode}
            onChange={e => setTestCode(e.target.value.toUpperCase())}
            placeholder="Enter Code (e.g. EARLYBIRD15 or STARTUP500)"
            className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
          />
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Cart Subtotal (₹):</span>
            <input
              type="number"
              value={testSubtotal}
              onChange={e => setTestSubtotal(parseFloat(e.target.value) || 0)}
              className="w-24 px-2.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            Test Code
          </button>
          {testResult && (
            <div className="ml-2 flex items-center gap-2 text-xs">
              {testResult.success ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Valid! Discount: ₹{testResult.calculatedAmount} ({testResult.discount?.name})
                </span>
              ) : (
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {testResult.error}
                </span>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Discounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">Loading coupons...</div>
        ) : discounts.map(d => (
          <div
            key={d.id}
            className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between shadow-sm hover:border-indigo-200 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-black px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> {d.code}
                </span>
                <Badge status={d.status} />
              </div>

              <h3 className="font-bold text-slate-900 text-base mt-3">{d.name}</h3>

              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Discount Value</p>
                  <p className="text-xl font-black text-slate-900">
                    {d.type === 'PERCENTAGE' ? `${d.value}% Off` : `₹${d.value.toLocaleString()} Flat`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Min Spend</p>
                  <p className="text-xs font-semibold text-slate-700">₹{d.minPurchaseAmount.toLocaleString()}</p>
                </div>
              </div>

              {/* Usage Count Progress */}
              <div className="mt-4">
                <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                  <span>Usage Utilization</span>
                  <span>{d.currentUsageCount} / {d.maxUsageCount} used</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (d.currentUsageCount / d.maxUsageCount) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 text-[11px] text-slate-500 space-y-1">
                <p>Validity: {d.startDate} to {d.endDate}</p>
                <p>Min Qty: {d.minQuantity} items</p>
              </div>
            </div>

            {user?.role === 'SUPER_ADMIN' && (
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => openEdit(d)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Rule
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Discount Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingDiscount ? 'Edit Discount Rule' : 'New Discount Coupon'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDiscount} className="py-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SUMMER25"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Summer Scale 25%"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Value ({formData.type === 'PERCENTAGE' ? '%' : '₹'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={formData.value}
                    onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Min Purchase (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.minPurchaseAmount}
                    onChange={e => setFormData({ ...formData, minPurchaseAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Max Redemptions
                  </label>
                  <input
                    type="number"
                    value={formData.maxUsageCount}
                    onChange={e => setFormData({ ...formData, maxUsageCount: parseInt(e.target.value, 10) || 100 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
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
                  Save Discount Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
