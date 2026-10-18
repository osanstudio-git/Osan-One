import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User as Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  loading: boolean;
  setDemoProfile: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  setDemoProfile: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    const saved = localStorage.getItem('osan_demo_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.role === 'Super_HR' || parsed.role === 'HR')) {
          parsed.role = 'HR';
        }
        return parsed;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  const setDemoProfile = (newProfile: Profile | null) => {
    setProfile(newProfile);
    if (newProfile) {
      localStorage.setItem('osan_demo_profile', JSON.stringify(newProfile));
      // Create synthetic session for demo auth
      const mockSession: any = {
        access_token: 'demo-token',
        user: { id: newProfile.id, email: newProfile.email }
      };
      setSession(mockSession);
      setUser(mockSession.user);
    } else {
      localStorage.removeItem('osan_demo_profile');
      setSession(null);
      setUser(null);
    }
  };

  useEffect(() => {
    // Check initial demo profile in localStorage
    const saved = localStorage.getItem('osan_demo_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const mockSession: any = {
          access_token: 'demo-token',
          user: { id: parsed.id, email: parsed.email }
        };
        setSession(mockSession);
        setUser(mockSession.user);
        setProfile(parsed);
        setLoading(false);
        return;
      } catch (e) {
        localStorage.removeItem('osan_demo_profile');
      }
    }

    // Get initial Supabase session if no demo profile saved
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
      } else if (data) {
        // Map database columns (including leave_balance_yearly, etc.) to user profile
        const mapped: Profile = {
          ...(data as any),
          role: (data.role === 'Super_HR' ? 'HR' : data.role) || 'Employee',
          leave_balances: {
            yearly: data.leave_balance_yearly ?? 30,
            sick: data.leave_balance_sick ?? 14,
            pregnancy: data.leave_balance_maternity ?? 98,
          }
        };
        setProfile(mapped);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('osan_demo_profile');
    setProfile(null);
    setSession(null);
    setUser(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, setDemoProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
