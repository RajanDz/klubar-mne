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
        <div className="app-header__info">
          <h1 className="app-header__club-name">{clubName}</h1>
          {userName && (
            <p className="app-header__subtitle">vlasnik: {userName}</p>
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
              className={`tab-button ${activeTab === tab.id ? 'tab-button--active' : ''}`}
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
