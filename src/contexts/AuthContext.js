import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// AuthContext drži podatke o prijavljenom korisniku i profilu iz baze.
// Svaka komponenta koja treba ove podatke poziva useAuth().
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // user — Supabase Auth korisnik (ili null ako nije prijavljen)
  // profile — red iz public.users sa podacima o ulozi i klubu
  // loading — true dok se provjerava postojeća sesija pri učitavanju
  // profileError — ako korisnik postoji u Auth ali nema zapis u public.users
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    // Provjeriti da li postoji aktivna sesija pri prvom učitavanju aplikacije
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        loadProfile(currentUser.id);
      } else {
        setLoading(false);
      }
    });

    // Pratiti promjene stanja autentifikacije (prijava, odjava, istek sesije)
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

  // Učitava profil korisnika iz public.users zajedno sa podacima o klubu
  async function loadProfile(userId) {
    setProfileError(null);
    const { data, error } = await supabase
      .from('users')
      .select('id, club_id, full_name, email, role, clubs(id, name)')
      .eq('id', userId)
      .single();

    if (error) {
      // Korisnik postoji u Auth ali nema zapis u public.users
      setProfileError('Korisnički nalog nije povezan ni sa jednim klubom.');
      setProfile(null);
    } else {
      setProfile(data);
    }
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = { user, profile, loading, profileError, signOut };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
