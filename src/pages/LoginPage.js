import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

function LoginPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [mode, setMode] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError('Pogrešan email ili lozinka. Pokušajte ponovo.');
      setLoading(false);
      return;
    }

    navigate('/', { replace: true });
  }

  async function handleInviteRegister(e) {
    e.preventDefault();
    setInviteError('');
    setInviteLoading(true);

    const code = inviteCode.trim().toUpperCase();

    const { data: checkData, error: checkError } = await supabase.rpc('check_invite', {
      p_code: code,
    });

    if (checkError || !checkData || checkData.length === 0) {
      setInviteError('Kod nije validan ili je istekao.');
      setInviteLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: inviteEmail.trim(),
      password: invitePassword,
    });

    if (signUpError) {
      setInviteError(signUpError.message);
      setInviteLoading(false);
      return;
    }

    const { error: registerError } = await supabase.rpc('register_via_invite', {
      p_code: code,
      p_full_name: inviteName.trim(),
      p_email: inviteEmail.trim(),
    });

    if (registerError) {
      setInviteError(registerError.message);
      setInviteLoading(false);
      return;
    }

    await refreshProfile();
    navigate('/', { replace: true });
  }

  function switchToInvite() {
    setError('');
    setMode('invite');
  }

  function switchToLogin() {
    setInviteError('');
    setMode('login');
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__brand">
          <h1 className="login-card__title">Klubar</h1>
          <p className="login-card__subtitle">Upravljanje sportskim klubovima</p>
        </div>

        {mode === 'login' && (
          <>
            <form onSubmit={handleLogin}>
              <div className="form-field">
                <label className="form-label" htmlFor="email">
                  Email adresa
                </label>
                <input
                  id="email"
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vase@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="password">
                  Lozinka
                </label>
                <input
                  id="password"
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && <p className="form-error">{error}</p>}

              <button
                className="btn btn-primary btn-full"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Prijavljivanje...' : 'Prijavi se'}
              </button>
            </form>

            <div className="login-invite-toggle">
              <button className="login-invite-toggle__btn" onClick={switchToInvite}>
                Trener? Prijava invite kodom →
              </button>
            </div>
          </>
        )}

        {mode === 'invite' && (
          <>
            <button className="login-back" onClick={switchToLogin}>
              ← Nazad na prijavu
            </button>

            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600 }}>
              Registracija invite kodom
            </h2>

            <form onSubmit={handleInviteRegister}>
              <div className="form-field">
                <label className="form-label" htmlFor="invite-code">
                  Invite kod <span className="form-label__optional">(6 karaktera)</span>
                </label>
                <input
                  id="invite-code"
                  className="form-input"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="npr. K7X2M3"
                  maxLength={6}
                  required
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="invite-name">
                  Ime i prezime
                </label>
                <input
                  id="invite-name"
                  className="form-input"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="npr. Marko Marković"
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="invite-email">
                  Email adresa
                </label>
                <input
                  id="invite-email"
                  className="form-input"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="vase@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="invite-password">
                  Lozinka
                </label>
                <input
                  id="invite-password"
                  className="form-input"
                  type="password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              {inviteError && <p className="form-error">{inviteError}</p>}

              <button
                className="btn btn-primary btn-full"
                type="submit"
                disabled={inviteLoading}
              >
                {inviteLoading ? 'Registracija...' : 'Registruj se'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
