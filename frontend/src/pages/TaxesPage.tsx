import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { Tax } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Receipt, Plus, Search, Edit2, X, Percent } from 'lucide-react';

export const TaxesPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: '',
    rate: 0,
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'SURCHARGE',
    description: '',
    effectiveStartDate: new Date().toISOString().split('T')[0],
    effectiveEndDate: `${new Date().getUTCFullYear() + 4}-12-31`,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });

  const fetchTaxes = async () => {
    try {
      setLoading(true);
      const res = await api.get<Tax[]>('/taxes');
      setTaxes(res);
    } catch (err: any) {
      error(err.message || 'Failed to load tax rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxes();
  }, []);

  const openCreate = () => {
    setEditingTax(null);
    setFormData({
      name: '',
      rate: 0,
      type: 'PERCENTAGE',
      description: '',
      effectiveStartDate: new Date().toISOString().split('T')[0],
      effectiveEndDate: `${new Date().getUTCFullYear() + 4}-12-31`,
      status: 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  const openEdit = (t: Tax) => {
    setEditingTax(t);
    setFormData({
      name: t.name,
      rate: t.rate,
      type: t.type,
      description: t.description,
      effectiveStartDate: t.effectiveStartDate,
      effectiveEndDate: t.effectiveEndDate,
      status: t.status
    });
    setIsModalOpen(true);
  };

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTax) {
        await api.put(`/taxes/${editingTax.id}`, formData);
        success('Tax rule updated');
      } else {
        await api.post('/taxes', formData);
        success('New tax rule configured');
      }
      setIsModalOpen(false);
      fetchTaxes();
    } catch (err: any) {
      error(err.message || 'Failed to save tax rule');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Tax Configuration Rules</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure GST, VAT, and surcharge rates. Applied rates are snapshotted on invoices for historical integrity.
          </p>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Tax Rule
          </button>
        )}
      </div>

      {/* Taxes Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3.5 px-5">Tax Name</th>
              <th className="py-3.5 px-5">Rate (%)</th>
              <th className="py-3.5 px-5">Calculation Type</th>
              <th className="py-3.5 px-5">Effective Window</th>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400">Loading taxes...</td>
              </tr>
            ) : taxes.map(t => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="py-3.5 px-5">
                  <p className="font-bold text-slate-900">{t.name}</p>
                  <p className="text-[11px] text-slate-400">{t.description}</p>
                </td>
                <td className="py-3.5 px-5">
                  <span className="font-mono font-black text-indigo-700 text-sm">{t.rate}%</span>
                </td>
                <td className="py-3.5 px-5 text-slate-700 font-semibold">{t.type}</td>
                <td className="py-3.5 px-5 font-mono text-slate-600">
                  {t.effectiveStartDate} &rarr; {t.effectiveEndDate}
                </td>
                <td className="py-3.5 px-5">
                  <Badge status={t.status} />
                </td>
                <td className="py-3.5 px-5 text-right">
                  {user?.role === 'SUPER_ADMIN' && (
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                      title="Edit Tax Rule"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tax Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingTax ? 'Edit Tax Rule' : 'New Tax Rule'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTax} className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Tax Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. GST 18%"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Rate (%) *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={formData.rate}
                    onChange={e => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Type *</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="SURCHARGE">Surcharge</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Legal clause / applicability scope"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.effectiveStartDate}
                    onChange={e => setFormData({ ...formData, effectiveStartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.effectiveEndDate}
                    onChange={e => setFormData({ ...formData, effectiveEndDate: e.target.value })}
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
                  Save Tax Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
