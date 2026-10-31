import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { QuotationTemplate, Product, SubscriptionPlan, Tax } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { useNavigate } from 'react-router-dom';
import { adjustPriceForVariant, getVariantSurcharge } from '../lib/pricing.ts';
import {
  FileSpreadsheet,
  Plus,
  Copy,
  Trash2,
  Edit,
  ArrowRight,
  X,
  Layers,
  PlusCircle,
  Clock,
  Sparkles
} from 'lucide-react';

export const QuotationTemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuotationTemplate | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validityDurationDays, setValidityDurationDays] = useState(30);
  const [planId, setPlanId] = useState('');
  const [taxIds, setTaxIds] = useState<string[]>([]);
  const [lines, setLines] = useState<{ productId: string; variantId?: string; quantity: number; unitPrice: number }[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tRes, pRes, plRes, txRes] = await Promise.all([
        api.get<QuotationTemplate[]>('/quotation-templates'),
        api.get<Product[]>('/products'),
        api.get<SubscriptionPlan[]>('/plans'),
        api.get<Tax[]>('/taxes')
      ]);
      setTemplates(tRes);
      setProducts(pRes);
      setPlans(plRes);
      setTaxes(txRes);
    } catch (err: any) {
      error(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setName('');
    setDescription('');
    setValidityDurationDays(30);
    setPlanId(plans.find(plan => plan.status === 'ACTIVE')?.id || '');
    setTaxIds([]);
    const firstProduct = products.find(product => product.status === 'ACTIVE');
    const firstVariant = firstProduct?.variants.find(variant => variant.status === 'ACTIVE');
    setLines([
      {
        productId: firstProduct?.id || '',
        variantId: firstVariant?.id,
        quantity: 1,
        unitPrice: (firstProduct?.baseSalesPrice ?? 0) + getVariantSurcharge(firstProduct, firstVariant?.id)
      }
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (t: QuotationTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setDescription(t.description);
    setValidityDurationDays(t.validityDurationDays);
    setPlanId(t.planId || '');
    setTaxIds(t.taxIds || []);
    setLines(t.lines || []);
    setIsModalOpen(true);
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/quotation-templates/${id}/duplicate`);
      success('Template cloned successfully');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to duplicate template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/quotation-templates/${id}`);
      success('Template deleted');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete template');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error('Template name is required');
      return;
    }

    try {
      const payload = {
        name,
        description,
        validityDurationDays: Number(validityDurationDays),
        planId: planId || undefined,
        lines,
        taxIds
      };

      if (editingTemplate) {
        await api.put(`/quotation-templates/${editingTemplate.id}`, payload);
        success('Template updated');
      } else {
        await api.post('/quotation-templates', payload);
        success('Quotation template established');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save template');
    }
  };

  const handleUseTemplate = (templateId: string) => {
    navigate(`/subscriptions?createWithTemplate=${templateId}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Quotation Templates</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Standardize pricing bundles, validity timeframes, and multi-line items for quick quote generation.
          </p>
        </div>
        {user?.role !== 'CUSTOMER' && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> Create Template
          </button>
        )}
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">No quotation templates configured yet.</div>
        ) : (
          templates.map(tmpl => {
            const plan = plans.find(p => p.id === tmpl.planId);
            const totalLinesPrice = tmpl.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

            return (
              <div
                key={tmpl.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between shadow-sm hover:border-indigo-200 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{tmpl.validityDurationDays} Days Validity</span>
                    </div>
                    {user?.role !== 'CUSTOMER' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDuplicate(tmpl.id)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                          title="Duplicate Template"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(tmpl)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded"
                          title="Edit Template"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {user?.role === 'SUPER_ADMIN' && (
                          <button
                            onClick={() => handleDelete(tmpl.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mt-2 tracking-tight group-hover:text-indigo-600 transition-colors">
                    {tmpl.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tmpl.description || 'Preconfigured quotation bundle'}</p>

                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Bundle Subtotal</p>
                      <p className="text-xl font-black text-slate-900">₹{totalLinesPrice.toLocaleString()}</p>
                    </div>
                    {plan && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Target Plan</p>
                        <p className="text-xs font-semibold text-indigo-700 truncate max-w-[120px]">{plan.name}</p>
                      </div>
                    )}
                  </div>

                  {/* Lines list */}
                  <div className="mt-3">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Bundled Items ({tmpl.lines.length})</p>
                    <div className="space-y-1">
                      {tmpl.lines.map((line, idx) => {
                        const prod = products.find(p => p.id === line.productId);
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs text-slate-700 py-0.5">
                            <span className="truncate pr-2">
                              {line.quantity}x {prod?.name || 'Software Line'}
                            </span>
                            <span className="font-mono text-slate-900 shrink-0 font-medium">
                              ₹{(line.quantity * line.unitPrice).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Taxes: {tmpl.taxIds?.length || 0} applied</span>
                  <button
                    onClick={() => handleUseTemplate(tmpl.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    Generate Quotation <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Template Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingTemplate ? 'Edit Quotation Template' : 'Configure Quotation Template'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Enterprise Onboarding Suite"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Validity Duration (Days) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={validityDurationDays}
                    onChange={e => setValidityDurationDays(parseInt(e.target.value, 10) || 30)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Notes on who this template applies to..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Default Subscription Plan
                  </label>
                  <select
                    value={planId}
                    onChange={e => setPlanId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="">None / Custom</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.billingPrice}/{p.billingFrequency.toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Applicable Taxes
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {taxes.map(t => (
                      <label key={t.id} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={taxIds.includes(t.id)}
                          onChange={e => {
                            if (e.target.checked) setTaxIds([...taxIds, t.id]);
                            else setTaxIds(taxIds.filter(id => id !== t.id));
                          }}
                          className="w-3.5 h-3.5 text-indigo-600 rounded"
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Multi-Line Items */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" /> Quotation Line Items
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
                          quantity: 1,
                          unitPrice: (firstProd?.baseSalesPrice ?? 0) + getVariantSurcharge(firstProd, firstVariant?.id)
                        }
                      ]);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Product Line
                  </button>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {lines.map((l, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Product</label>
                        <select
                          value={l.productId}
                          onChange={e => {
                            const pId = e.target.value;
                            const pr = products.find(p => p.id === pId);
                            const updated = [...lines];
                            updated[idx].productId = pId;
                            const variant = pr?.variants.find(candidate => candidate.status === 'ACTIVE');
                            updated[idx].variantId = variant?.id;
                            updated[idx].unitPrice = (pr?.baseSalesPrice ?? 0) + getVariantSurcharge(pr, variant?.id);
                            setLines(updated);
                          }}
                          className="w-full px-2 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        >
                          {products.filter(product => product.status === 'ACTIVE').map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Variant</label>
                        <select
                          value={l.variantId || ''}
                          onChange={event => {
                            const product = products.find(candidate => candidate.id === l.productId);
                            const updated = [...lines];
                            const nextVariantId = event.target.value || undefined;
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
                          className="w-full px-2 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-3">
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
                          className="w-full px-2 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-1 text-center pt-3">
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
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
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
