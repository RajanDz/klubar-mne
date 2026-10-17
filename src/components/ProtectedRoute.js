import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute({ children }) {
  const { user, profile, loading, profileError, signOut } = useAuth();

  if (loading) {
    return (
      <div className="fullpage-center">
        <p className="text-secondary">Učitavanje...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profileError) {
    return (
      <div className="fullpage-center">
        <p className="text-error">{profileError}</p>
        <button className="btn btn-secondary" onClick={signOut}>
          Odjavi se
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fullpage-center">
        <p className="text-secondary">Učitavanje profila...</p>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
