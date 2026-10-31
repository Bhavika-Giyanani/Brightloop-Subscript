import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { User } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import {
  ShieldCheck,
  Plus,
  Search,
  UserCheck,
  Mail,
  Phone,
  Building2,
  X,
  Lock,
  Edit2
} from 'lucide-react';

export const StaffManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [staffList, setStaffList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'INTERNAL_STAFF' | 'SUPER_ADMIN'>('INTERNAL_STAFF');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await api.get<User[]>('/staff');
      setStaffList(res);
    } catch (err: any) {
      error(err.message || 'Failed to fetch staff directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const openCreateModal = () => {
    setEditingStaff(null);
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setRole('INTERNAL_STAFF');
    setStatus('ACTIVE');
    setIsModalOpen(true);
  };

  const openEditModal = (s: User) => {
    setEditingStaff(s);
    setName(s.name);
    setEmail(s.email);
    setPassword('');
    setPhone(s.phone || '');
    setRole(s.role as any);
    setStatus(s.status);
    setIsModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        await api.patch(`/staff/${editingStaff.id}`, {
          name,
          phone,
          role,
          status,
          ...(password ? { newPassword: password } : {})
        });
        success('Staff credentials updated');
      } else {
        await api.post('/staff', {
          name,
          email,
          password,
          phone,
          role
        });
        success('Internal staff account created');
      }
      setIsModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      error(err.message || 'Operation failed');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Staff & Role Access Control</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authorized staff members, account executives, and assign administrative permissions.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 shrink-0"
        >
          <Plus className="w-4 h-4" /> Provision Staff Account
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3.5 px-5">Staff Member</th>
              <th className="py-3.5 px-5">Email & Contact</th>
              <th className="py-3.5 px-5">Assigned Role</th>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-slate-400">Loading staff directory...</td>
              </tr>
            ) : staffList.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{s.name}</p>
                      <p className="text-[11px] text-slate-400">ID: {s.id}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-5">
                  <p className="text-slate-800 font-medium">{s.email}</p>
                  <p className="text-[11px] text-slate-400">{s.phone || 'No direct phone'}</p>
                </td>
                <td className="py-3.5 px-5">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    s.role === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {s.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Internal Staff'}
                  </span>
                </td>
                <td className="py-3.5 px-5">
                  <Badge status={s.status} />
                </td>
                <td className="py-3.5 px-5 text-right">
                  <button
                    onClick={() => openEditModal(s)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    title="Edit Staff Member"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingStaff ? 'Update Staff Credentials' : 'Provision Staff Member'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Priya Nair"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              {!editingStaff && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Corporate Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="priya@brightloop.io"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {editingStaff ? 'Reset Password (Optional)' : 'Initial Password *'}
                </label>
                <input
                  type="password"
                  required={!editingStaff}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={editingStaff ? 'Leave blank to retain current' : 'Min 8 chars, uppercase, lowercase, special'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Security rule: more than 8 characters, including uppercase, lowercase, and a special symbol.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    System Role *
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white font-semibold"
                  >
                    <option value="INTERNAL_STAFF">Internal Staff</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Deactivated</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98234 56789"
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
                  {editingStaff ? 'Update Staff Member' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
