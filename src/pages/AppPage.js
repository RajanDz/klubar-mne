import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LjudiPage from '../sections/LjudiPage';
import GrupePage from '../sections/GrupePage';
import CoachesPage from '../sections/CoachesPage';
import DjecaPage from '../sections/DjecaPage';
import TreninziPage from '../sections/TreninziPage';
import NovacPage from '../sections/NovacPage';
import OverviewPage from '../sections/OverviewPage';
import PostavkePage from '../sections/PostavkePage';
import './AppPage.css';

/* ============================================================
   SVG Icons for bottom nav
   ============================================================ */

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9L12 2L21 9V20a1 1 0 01-1 1H15V15H9V21H4a1 1 0 01-1-1V9Z" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

/* ============================================================
   AppPage
   ============================================================ */

function AppPage() {
  const { profile, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');

  const clubName = profile?.clubs?.name ?? 'Klub';
  const userName = profile?.full_name ?? '';

  /* Handle nav item click — just switch tabs; Ljudi has its own sub-nav */
  function handleNavClick(id) {
    setActiveTab(id);
  }

  function renderContent() {
    if (activeTab === 'overview')    return <OverviewPage onNavigate={handleNavClick} />;
    if (activeTab === 'settings')    return <PostavkePage />;
    if (activeTab === 'people')      return <LjudiPage />;
    if (activeTab === 'treninzi')    return <TreninziPage />;
    if (activeTab === 'memberships') return <NovacPage />;

    /* Fallback for any legacy direct links to old tabs */
    if (activeTab === 'groups')   return <GrupePage />;
    if (activeTab === 'coaches')  return <CoachesPage />;
    if (activeTab === 'children') return <DjecaPage />;

    return (
      <div className="placeholder-section">
        <p>Ova sekcija još nije implementirana.</p>
      </div>
    );
  }

  /* Nav items config */
  const ALL_NAV_ITEMS = [
    { id: 'overview',    label: 'Pregled',   icon: <IconHome />,     roles: ['owner', 'coordinator', 'trener'] },
    { id: 'people',      label: 'Ljudi',     icon: <IconPeople />,   roles: ['owner', 'coordinator'] },
    { id: 'treninzi',    label: 'Treninzi',  icon: <IconCalendar />, roles: ['owner', 'coordinator', 'trener'] },
    { id: 'memberships', label: 'Novac',     icon: <IconCard />,     roles: ['owner', 'coordinator', 'trener'] },
    { id: 'settings',    label: 'Postavke',  icon: <IconSettings />, roles: ['owner', 'coordinator', 'trener'] },
  ];

  const userRole = profile?.roles?.value ?? '';
  const NAV_ITEMS = ALL_NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  function isNavActive(id) {
    if (id === 'people') return activeTab === 'people';
    return activeTab === id;
  }

  return (
    <div className="app-page">
      {/* ---- Header ---- */}
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

      {/* ---- Desktop top nav (hidden on mobile) ---- */}
      <nav className="app-nav">
        <div className="app-nav__bar">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-tab ${isNavActive(item.id) ? 'nav-tab--active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ---- Main content ---- */}
      <main className="app-content">
        {renderContent()}
      </main>

      {/* ---- Mobile bottom nav (hidden on desktop) ---- */}
      <nav className="app-bottom-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`app-bottom-nav__item ${isNavActive(item.id) ? 'app-bottom-nav__item--active' : ''}`}
            onClick={() => handleNavClick(item.id)}
          >
            {item.icon}
            <span className="app-bottom-nav__label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default AppPage;
