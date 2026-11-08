import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { applyThemeVars } from '../lib/theme';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        loadProfile(currentUser.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await loadProfile(currentUser.id);
        } else {
          setProfile(null);
          setProfileError(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    setProfileError(null);
    const { data, error } = await supabase
      .from('users')
      .select('id, club_id, full_name, email, coach_id, clubs(id, name, fee, sport, logo_url, theme), roles(id, value)')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Profile load error:', error);
      if (error.code === 'PGRST116') {
        setProfile(null);
        setProfileError(null);
      } else {
        setProfileError('Korisnički nalog nije povezan ni sa jednim klubom.');
        setProfile(null);
      }
    } else {
      setProfile(data);
      applyThemeVars(data.clubs?.theme ?? {});
    }
    setLoading(false);
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
