import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { api } from '../lib/api.ts';
import { validateEmailAddress, validatePassword } from '../../../shared/authValidation.ts';
import {
  Lock,
  Mail,
  User,
  Building2,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const AuthPages: React.FC = () => {
  const { login, register } = useAuth();
  const { success, error } = useToast();

  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('resetToken') || '');
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT' | 'RESET'>(() => (
    new URLSearchParams(window.location.search).has('resetToken') ? 'RESET' : 'LOGIN'
  ));

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  // Reset states
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      error('Email and password are required.');
      return;
    }
    const emailValidation = validateEmailAddress(email);
    if (!emailValidation.valid) {
      error(emailValidation.error || 'Enter a valid email address.');
      return;
    }
    try {
      setLoading(true);
      await login(email.trim(), password);
      success('Logged in successfully. Welcome to Brightloop!');
    } catch (err: any) {
      error(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !companyName.trim() || !email.trim() || !password) {
      error('Name, email, password, and company name are required.');
      return;
    }
    const emailValidation = validateEmailAddress(email);
    if (!emailValidation.valid) {
      error(emailValidation.error || 'Enter a valid email address.');
      return;
    }
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      error(passwordValidation.error || 'Password does not meet the requirements.');
      return;
    }
    try {
      setLoading(true);
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        companyName: companyName.trim(),
        phone,
        billingAddress
      });
      success('Account registered! Welcome to the Brightloop Customer Portal.');
    } catch (err: any) {
      error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res: any = await api.post('/auth/forgot-password', { email: email.trim() });
      success(res.message);
    } catch (err: any) {
      error(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res: any = await api.post('/auth/reset-password', {
        token: resetToken,
        newPassword
      });
      success(res.message || 'Password reset successful. Please log in.');
      setMode('LOGIN');
      setPassword('');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err: any) {
      error(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-[#0B132B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-2xl shadow-xl shadow-indigo-500/30">
          B
        </div>
        <h2 className="mt-4 text-2xl font-black text-white tracking-tight">Brightloop Software</h2>
        <p className="mt-1 text-xs text-indigo-300">
          Enterprise Subscription Billing, Quotations, and Invoicing Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border border-slate-100">
          {/* MODE: LOGIN */}
          {mode === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">Account Sign In</span>
                <button
                  type="button"
                  onClick={() => setMode('REGISTER')}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  New customer? Register
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode('FORGOT')}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
              >
                {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* MODE: REGISTER (CUSTOMER SELF-SERVICE) */}
          {mode === 'REGISTER' && (
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">Customer Registration</span>
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Already registered? Sign In
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Company / Organization Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Acme Technologies"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 555-0123"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Corporate Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="billing@acme.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="More than 8 characters, uppercase, lowercase, and a special character"
                  minLength={9}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Passwords must exceed 8 characters and include an uppercase letter, lowercase letter, and special character.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
              >
                {loading ? 'Creating Account...' : 'Register Customer Account'}
              </button>
            </form>
          )}

          {/* MODE: FORGOT PASSWORD */}
          {mode === 'FORGOT' && (
            <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">Recover Password</span>
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Back to Sign In
                </button>
              </div>

              <p className="text-slate-500 text-xs">
                Enter your registered email address to receive password reset authorization.
              </p>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                {loading ? 'Dispatched...' : 'Send Password Reset Link'}
              </button>
            </form>
          )}

          {/* MODE: RESET PASSWORD */}
          {mode === 'RESET' && (
            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">Set New Password</span>
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="More than 8 characters, uppercase, lowercase, and a special character"
                  minLength={9}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/30"
              >
                {loading ? 'Updating...' : 'Save New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
