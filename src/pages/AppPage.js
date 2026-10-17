import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GrupePage from '../sections/GrupePage';
import './AppPage.css';

// Lista tabova koji postoje u aplikaciji.
// U ovoj fazi implementirana je samo sekcija Grupe.
const TABOVI = [
  { id: 'pregled',    naziv: 'Pregled' },
  { id: 'grupe',      naziv: 'Grupe' },
  { id: 'djeca',      naziv: 'Djeca' },
  { id: 'dolasci',    naziv: 'Dolasci' },
  { id: 'clanarine',  naziv: 'Članarine' },
  { id: 'treneri',    naziv: 'Treneri' },
  { id: 'postavke',   naziv: 'Postavke' },
];

function AppPage() {
  const { profile, signOut } = useAuth();
  const [aktivniTab, setAktivniTab] = useState('grupe');

  const imeKluba = profile?.clubs?.name ?? 'Klub';
  const imeKorisnika = profile?.full_name ?? '';

  function renderujSadrzaj() {
    if (aktivniTab === 'grupe') {
      return <GrupePage />;
    }

    // Ostale sekcije će biti implementirane u narednim fazama
    return (
      <div className="placeholder-sekcija">
        <p>Ova sekcija još nije implementirana.</p>
      </div>
    );
  }

  return (
    <div className="app-page">
      <header className="app-header">
        <div className="app-header__info">
          <h1 className="app-header__naziv-kluba">{imeKluba}</h1>
          {imeKorisnika && (
            <p className="app-header__podnaslov">vlasnik: {imeKorisnika}</p>
          )}
        </div>
        <button className="btn btn-odjava" onClick={signOut}>
          Odjavi se
        </button>
      </header>

      <nav className="app-navigacija">
        <div className="app-navigacija__lista">
          {TABOVI.map((tab) => (
            <button
              key={tab.id}
              className={`tab-dugme ${aktivniTab === tab.id ? 'tab-dugme--aktivan' : ''}`}
              onClick={() => setAktivniTab(tab.id)}
            >
              {tab.naziv}
            </button>
          ))}
        </div>
      </nav>

      <main className="app-sadrzaj">
        {renderujSadrzaj()}
      </main>
    </div>
  );
}

export default AppPage;
