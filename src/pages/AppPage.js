import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GrupePage from '../sections/GrupePage';
import CoachesPage from '../sections/CoachesPage';
import './AppPage.css';

const TABS = [
  { id: 'overview',     label: 'Pregled' },
  { id: 'groups',       label: 'Grupe' },
  { id: 'children',     label: 'Djeca' },
  { id: 'attendance',   label: 'Dolasci' },
  { id: 'memberships',  label: 'Članarine' },
  { id: 'coaches',      label: 'Treneri' },
  { id: 'settings',     label: 'Postavke' },
];

function AppPage() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('groups');

  const clubName = profile?.clubs?.name ?? 'Klub';
  const userName = profile?.full_name ?? '';

  function renderContent() {
    if (activeTab === 'groups')  return <GrupePage />;
    if (activeTab === 'coaches') return <CoachesPage />;

    return (
      <div className="placeholder-section">
        <p>Ova sekcija još nije implementirana.</p>
      </div>
    );
  }

  return (
    <div className="app-page">
      <header className="app-header">
        <div className="app-header__left">
          <span className="app-header__club-name">{clubName}</span>
          {userName && (
            <span className="app-header__user">{userName}</span>
          )}
        </div>
        <button className="btn-sign-out" onClick={signOut}>
          Odjavi se
        </button>
      </header>

      <nav className="app-nav">
        <div className="app-nav__list">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'nav-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="app-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default AppPage;
