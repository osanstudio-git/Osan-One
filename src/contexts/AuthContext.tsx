import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User as Profile } from '../types';
import { getSavedLocalAvatar, getEmployeeAvatarFromDb } from '../lib/databaseService';

interface AuthContextType {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  loading: boolean;
  setDemoProfile: (profile: Profile | null) => void;
  updateCurrentUserProfile: (updates: Partial<Profile>) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  setDemoProfile: () => {},
  updateCurrentUserProfile: () => {},
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
        if (parsed?.id) {
          const cached = getSavedLocalAvatar(parsed.id, parsed.email, parsed.phone);
          if (cached) parsed.avatar_url = cached;
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
    let toSave = newProfile;
    if (toSave?.id) {
      const cached = getSavedLocalAvatar(toSave.id, toSave.email, toSave.phone);
      if (cached && !toSave.avatar_url) {
        toSave = { ...toSave, avatar_url: cached };
      }
    }
    setProfile(toSave);
    if (toSave) {
      localStorage.setItem('osan_demo_profile', JSON.stringify(toSave));
      // Create synthetic session for demo auth
      const mockSession: any = {
        access_token: 'demo-token',
        user: { id: toSave.id, email: toSave.email }
      };
      setSession(mockSession);
      setUser(mockSession.user);
    } else {
      localStorage.removeItem('osan_demo_profile');
      setSession(null);
      setUser(null);
    }
  };

  const updateCurrentUserProfile = (updates: Partial<Profile>) => {
    setProfile(prev => {
      if (!prev) return null;
      const next = { ...prev, ...updates };
      const saved = localStorage.getItem('osan_demo_profile');
      if (saved) {
        localStorage.setItem('osan_demo_profile', JSON.stringify(next));
      }
      return next;
    });
  };

  useEffect(() => {
    // Listen for cross-component / cross-window avatar updates in real time
    const handleAvatarUpdate = (e: any) => {
      const detail = e?.detail;
      if (detail && detail.id) {
        setProfile(prev => {
          if (prev && (prev.id === detail.id || prev.email === detail.id)) {
            const updated = { ...prev, avatar_url: detail.avatarUrl || undefined };
            localStorage.setItem('osan_demo_profile', JSON.stringify(updated));
            return updated;
          }
          return prev;
        });
      }
    };
    window.addEventListener('osan_avatar_updated', handleAvatarUpdate);

    // Check initial demo profile in localStorage
    const saved = localStorage.getItem('osan_demo_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.id) {
          const cached = getSavedLocalAvatar(parsed.id);
          if (cached) parsed.avatar_url = cached;
        }
        const mockSession: any = {
          access_token: 'demo-token',
          user: { id: parsed.id, email: parsed.email }
        };
        setSession(mockSession);
        setUser(mockSession.user);
        setProfile(parsed);
        setLoading(false);

        // Fetch latest profile from DB in background to sync any updates made by HR
        if (parsed.id) {
          fetchProfile(parsed.id);
        }
        return () => {
          window.removeEventListener('osan_avatar_updated', handleAvatarUpdate);
        };
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

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('osan_avatar_updated', handleAvatarUpdate);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);
      let query = supabase.from('users').select('*');
      if (isUuid) {
        query = query.eq('id', userId);
      } else {
        query = query.or(`id.eq.${userId},email.eq.${userId}`);
      }
      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
      } else if (data) {
        const cloudAvatar = await getEmployeeAvatarFromDb(data.id || userId);
        const cached = cloudAvatar || getSavedLocalAvatar(data.id, data.email, data.phone) || getSavedLocalAvatar(userId);
        // Map database columns (including leave_balance_yearly, etc.) to user profile
        const mapped: Profile = {
          ...(data as any),
          avatar_url: data.avatar_url || cached || undefined,
          role: (data.role === 'Super_HR' ? 'HR' : data.role) || 'Employee',
          leave_balances: {
            yearly: data.leave_balance_yearly ?? 30,
            sick: data.leave_balance_sick ?? 14,
            pregnancy: data.leave_balance_maternity ?? 98,
          }
        };
        setProfile(mapped);
        localStorage.setItem('osan_demo_profile', JSON.stringify(mapped));
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
    <AuthContext.Provider value={{ session, user, profile, loading, setDemoProfile, updateCurrentUserProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
