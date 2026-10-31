import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { Product, ProductType, ProductVariant } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Edit,
  Layers,
  DollarSign,
  AlertCircle,
  X,
  PlusCircle,
  Archive
} from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<ProductType>('SaaS');
  const [baseSalesPrice, setBaseSalesPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [variants, setVariants] = useState<{ id?: string; name: string; additionalPrice: number; sku: string }[]>([]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get<Product[]>('/products');
      setProducts(res);
    } catch (err: any) {
      error(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setType('SaaS');
    setBaseSalesPrice(0);
    setCostPrice(0);
    setDescription('');
    setVariants([]);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setType(p.type);
    setBaseSalesPrice(p.baseSalesPrice);
    setCostPrice(p.costPrice);
    setDescription(p.description);
    setVariants(
      p.variants.map(v => ({
        id: v.id,
        name: v.name,
        additionalPrice: v.additionalPrice,
        sku: v.sku
      }))
    );
    setIsModalOpen(true);
  };

  const addVariantRow = () => {
    setVariants([
      ...variants,
      { name: '', additionalPrice: 0, sku: `SKU-${variants.length + 1}` }
    ]);
  };

  const removeVariantRow = (index: number) => {
    if (variants.length <= 1) {
      info('At least one product variant is required.');
      return;
    }
    setVariants(variants.filter((_, idx) => idx !== index));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error('Product name is required');
      return;
    }

    try {
      const payload = {
        name,
        type,
        baseSalesPrice: Number(baseSalesPrice),
        costPrice: Number(costPrice),
        description,
        variants
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        success('Product & variants updated successfully');
      } else {
        await api.post('/products', payload);
        success('New product created successfully');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      error(err.message || 'Failed to save product');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete/archive "${name}"? Active subscription and billing references will be preserved automatically.`)) {
      return;
    }
    try {
      const res: any = await api.delete(`/products/${id}`);
      success(res.message || 'Product updated');
      fetchProducts();
    } catch (err: any) {
      error(err.message || 'Failed to remove product');
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Product Catalog & Variant Engine</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure SaaS platforms, addons, and calculate dynamic variant prices.
          </p>
        </div>
        {user?.role === 'SUPER_ADMIN' && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add New Product
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
            placeholder="Search products by name or features..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
          {['ALL', 'SaaS', 'Addon', 'Service', 'License'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === t ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">Loading catalog...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">No products matching your search.</div>
        ) : (
          filtered.map(product => (
            <div
              key={product.id}
              className={`bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-sm transition-all hover:shadow-md ${
                product.status === 'ARCHIVED' ? 'border-slate-200 opacity-60 bg-slate-50' : 'border-slate-200/90'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {product.type}
                    </span>
                    <Badge status={product.status} />
                  </div>
                  {user?.role === 'SUPER_ADMIN' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors"
                        title="Edit Product"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id, product.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 transition-colors"
                        title="Archive/Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 text-base mt-2.5 tracking-tight">{product.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.description}</p>

                {/* Base Pricing Banner */}
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Base Sales Price</p>
                    <p className="text-lg font-black text-slate-900">₹{product.baseSalesPrice.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Cost Price</p>
                    <p className="text-xs font-semibold text-slate-600">₹{product.costPrice.toLocaleString()}</p>
                  </div>
                </div>

                {/* Variants List */}
                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" /> Available Variants ({product.variants.length})
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {product.variants.map(v => {
                      const finalPrice = product.baseSalesPrice + v.additionalPrice;
                      return (
                        <div
                          key={v.id}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50/80 border border-slate-100"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-slate-800 truncate">{v.name}</p>
                            <span className="font-mono text-[10px] text-slate-400">{v.sku}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900">₹{finalPrice.toLocaleString()}</span>
                            {v.additionalPrice > 0 && (
                              <span className="block text-[10px] text-emerald-600 font-medium">
                                +₹{v.additionalPrice}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>ID: {product.id}</span>
                <span>Updated: {product.updatedAt.split('T')[0]}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingProduct ? 'Edit Product & Variant Specs' : 'Add New Product to Catalog'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Accounting Software Cloud"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Product Type *
                  </label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as ProductType)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  >
                    <option value="SaaS">SaaS Platform</option>
                    <option value="Addon">Addon / Extension</option>
                    <option value="Service">Professional Service</option>
                    <option value="License">Software License</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Base Sales Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={baseSalesPrice}
                    onChange={e => setBaseSalesPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={e => setCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Product Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe key features, SLA, and business value..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Product Variants Configuration */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" /> Product Variants & Pricing Rules
                  </span>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Variant
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {variants.map((v, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Variant Name</label>
                        <input
                          type="text"
                          required
                          value={v.name}
                          onChange={e => {
                            const updated = [...variants];
                            updated[idx].name = e.target.value;
                            setVariants(updated);
                          }}
                          placeholder="e.g. Odoo Integration"
                          className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Additional Price (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={v.additionalPrice}
                          onChange={e => {
                            const updated = [...variants];
                            updated[idx].additionalPrice = parseFloat(e.target.value) || 0;
                            setVariants(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">SKU Code</label>
                        <input
                          type="text"
                          value={v.sku}
                          onChange={e => {
                            const updated = [...variants];
                            updated[idx].sku = e.target.value;
                            setVariants(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div className="col-span-1 text-center pt-4">
                        <button
                          type="button"
                          onClick={() => removeVariantRow(idx)}
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
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
