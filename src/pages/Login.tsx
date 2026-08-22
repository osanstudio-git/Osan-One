import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Lock, LogIn, AlertCircle, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { MOCK_EMPLOYEES, MOCK_COMPANIES } from './hr/mockData';

export const Login = () => {
  const navigate = useNavigate();
  const { setDemoProfile } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginAsDemoUser = (userEmail: string, role: string) => {
    const emp = MOCK_EMPLOYEES.find(e => e.email.toLowerCase() === userEmail.toLowerCase()) || {
      id: `emp-demo-${role}`,
      name: `Demo ${role}`,
      email: userEmail,
      role: role as any,
      company_id: 'Nameer',
      company: 'Nameer',
      nationality: 'Omani' as const,
      gender: 'Male' as const,
      status: 'Active' as const,
      leave_balances: { yearly: 30, sick: 14, pregnancy: 98 },
      join_date: '2024-01-01'
    };
    setDemoProfile(emp as any);
    redirectUserByRole(role);
  };

  // Helper to check policy constraints
  const verifyCompanyAuthPolicy = (userEmail: string, userPhone?: string, typedAsEmail: boolean = true) => {
    // Find mock employee profile
    const emp = MOCK_EMPLOYEES.find(e => 
      e.email.toLowerCase() === userEmail.toLowerCase() || 
      (userPhone && e.phone === userPhone)
    );

    if (emp) {
      const company = MOCK_COMPANIES.find(c => c.name === emp.company);
      if (company && company.authPolicy) {
        if (company.authPolicy === 'email' && !typedAsEmail) {
          throw new Error(`${company.name} policy requires Email & Google Auth only. Phone logins are disabled.`);
        }
        if (company.authPolicy === 'phone' && typedAsEmail) {
          throw new Error(`${company.name} policy requires Phone Number & PIN only. Email logins are disabled.`);
        }
      }
      return emp;
    }
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const isEmail = identifier.includes('@');
    const cleanId = identifier.trim();

    try {
      // 1. Policy Constraint Checks (Verify first to block login methods)
      // 1. Policy & Mock Match Check
      let matchedEmp = null;
      if (isEmail) {
        matchedEmp = verifyCompanyAuthPolicy(cleanId, undefined, true);
      } else {
        const empByPhone = MOCK_EMPLOYEES.find(emp => emp.phone === cleanId);
        if (empByPhone) {
          matchedEmp = verifyCompanyAuthPolicy(empByPhone.email, cleanId, false);
        }
      }

      // If mock employee matches, set demo profile and sign in immediately
      if (matchedEmp) {
        setDemoProfile(matchedEmp as any);
        redirectUserByRole(matchedEmp.role);
        return;
      }

      // 2. Perform Supabase Cloud Auth if not matched locally
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
        throw new Error("Invalid credentials or unregistered account. Use demo buttons below to test.");
      }
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] mix-blend-screen" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-8 overflow-hidden">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6"
            >
              <LogIn className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Welcome Back</h1>
            <p className="text-slate-400">Sign in to access your dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 ml-1">Email or Phone Number</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                    {isEmailInput ? <Mail className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-xl pl-12 pr-4 py-3.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-600"
                    placeholder="email@company.com or 96891234567"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300 ml-1">
                  {isEmailInput ? 'Password' : 'Login PIN / Passcode'}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-500 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-xl pl-12 pr-4 py-3.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-600"
                    placeholder={isEmailInput ? '••••••••' : '••••••'}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden rounded-xl p-[1px] mt-2"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-slate-900 rounded-xl px-4 py-3.5 flex items-center justify-center gap-2 group-hover:bg-opacity-0 transition-all duration-300">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="font-semibold text-white">Sign In</span>
                    <LogIn className="w-4 h-4 text-white" />
                  </>
                )}
              </div>
            </button>

            {/* Quick Demo Login Switchers */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block text-center">
                Instant Demo Access (1-Click Login)
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => loginAsDemoUser('employee1@nameer.com', 'HR')}
                  className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-200 text-left flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-medium">🛡️ HR Admin</span>
                  <span className="text-[10px] text-blue-400 font-bold">Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => loginAsDemoUser('employee4@amer.com', 'Employee')}
                  className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-200 text-left flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-medium">👤 Employee</span>
                  <span className="text-[10px] text-emerald-400 font-bold">Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => loginAsDemoUser('employee2@masar.com', 'CEO')}
                  className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-200 text-left flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-medium">👔 CEO</span>
                  <span className="text-[10px] text-amber-400 font-bold">Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => loginAsDemoUser('employee3@osan.com', 'Accountant')}
                  className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-200 text-left flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-medium">💼 Accountant</span>
                  <span className="text-[10px] text-purple-400 font-bold">Login</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-slate-500 text-sm mt-8">
          HR & Attendance Management System
        </p>
      </motion.div>
    </div>
  );
};
