import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, LogIn, AlertCircle, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { authenticateUserInDb } from '../lib/databaseService';
import { OsanLogo } from '../components/common/OsanLogo';

export const Login = () => {
  const navigate = useNavigate();
  const { setDemoProfile } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const isEmail = identifier.includes('@');
    const cleanId = identifier.trim();

    try {
      if (!password.trim()) {
        throw new Error("Please enter your password or 6-digit PIN.");
      }

      // 1. Authenticate user from Supabase database / local records
      const matchedEmp = await authenticateUserInDb(cleanId, password);

      if (matchedEmp) {
        setDemoProfile(matchedEmp as any);
        redirectUserByRole(matchedEmp.role);
        return;
      }

      // 2. Fallback to Supabase Auth if not matched in database users table
      try {
        const { data, error: signInError } = await supabase.auth.signInWithPassword(
          isEmail ? { email: cleanId, password } : { email: `${cleanId}@phone-placeholder.com`, password }
        );

        if (signInError) throw signInError;

        if (data.user) {
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.user.id)
            .single();

          if (profileError) throw profileError;

          redirectUserByRole(profileData.role);
          return;
        }
      } catch (supabaseErr) {
        throw new Error("Invalid email/phone or PIN. Please check your login credentials.");
      }

      throw new Error("User record not found. Please check your registered phone or email.");
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const redirectUserByRole = (role: string) => {
    switch (role.toLowerCase()) {
      case 'ceo':
        navigate('/ceo');
        break;
      case 'super_hr':
      case 'hr':
        navigate('/hr');
        break;
      case 'accountant':
        navigate('/accountant');
        break;
      default:
        navigate('/dashboard');
    }
  };

  const isEmailInput = identifier.includes('@');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/60 to-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Soft Ambient Background Aesthetics */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-sky-200/40 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-blue-200/30 blur-[130px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl shadow-2xl p-8 overflow-hidden">
          
          {/* Official Brand Header */}
          <div className="text-center mb-6 flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mb-3"
            >
              <OsanLogo size="lg" />
            </motion.div>
            
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">Welcome Back</h1>
            <p className="text-slate-500 text-xs font-semibold mt-1">Sign in to access your enterprise dashboard</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-700">{error}</p>
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">Email or Phone Number</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#1D70B8] transition-colors">
                    {isEmailInput ? <Mail className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl pl-12 pr-4 py-3.5 outline-none focus:border-[#1D70B8] focus:ring-2 focus:ring-[#1D70B8]/15 transition-all placeholder:text-slate-400 text-xs font-medium"
                    placeholder="name@company.com or 96891234567"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">
                  {isEmailInput ? 'Password' : 'Login PIN / Passcode'}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#1D70B8] transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl pl-12 pr-4 py-3.5 outline-none focus:border-[#1D70B8] focus:ring-2 focus:ring-[#1D70B8]/15 transition-all placeholder:text-slate-400 text-xs font-medium"
                    placeholder={isEmailInput ? '••••••••' : '••••••'}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#1D70B8] hover:bg-[#155994] active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-[#1D70B8]/25 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 text-xs tracking-wide cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="font-bold text-white">Sign In to Account</span>
                  <LogIn className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-slate-500 text-xs mt-6 font-semibold">
          Osan Group • Multi-Tenant Enterprise HR Portal
        </p>
      </motion.div>
    </div>
  );
};
