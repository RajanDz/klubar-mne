import { useState } from 'react';
import ClanarinaTab from './ClanarinaTab';
import PredajeTab from './PredajeTab';
import './NovacPage.css';

function NovacPage() {
  const [tab, setTab] = useState('clanarine');

  return (
    <div className="novac-page">
      <div className="novac-tabs">
        <button
          className={`novac-tab ${tab === 'clanarine' ? 'novac-tab--active' : ''}`}
          onClick={() => setTab('clanarine')}
        >
          Članarine
        </button>
        <button
          className={`novac-tab ${tab === 'predaje' ? 'novac-tab--active' : ''}`}
          onClick={() => setTab('predaje')}
        >
          Predaje
        </button>
      </div>

      {tab === 'clanarine' ? <ClanarinaTab /> : <PredajeTab />}
    </div>
  );
}

export default NovacPage;
