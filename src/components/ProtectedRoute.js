import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Zaštićena ruta: korisnik koji nije prijavljen se preusmjerava na /login.
// Dok se provjera sesije ne završi, prikazuje se loading ekran.
// Ako korisnik nema profil u bazi, prikazuje se greška sa dugmetom za odjavu.
function ProtectedRoute({ children }) {
  const { user, profile, loading, profileError, signOut } = useAuth();

  if (loading) {
    return (
      <div className="fullpage-center">
        <p className="loading-text">Učitavanje...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profileError) {
    return (
      <div className="fullpage-center">
        <p className="error-text">{profileError}</p>
        <button className="btn btn-secondary" onClick={signOut}>
          Odjavi se
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fullpage-center">
        <p className="loading-text">Učitavanje profila...</p>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
