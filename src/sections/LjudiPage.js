import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DjecaView from './DjecaView';
import GrupeView from './GrupeView';
import TreneriView from './TreneriView';
import './LjudiPage.css';

/* ============================================================
   LjudiPage — container with internal sub-nav
   Switches between Djeca / Grupe / Treneri views
   ============================================================ */

function LjudiPage() {
  const { profile } = useAuth();
  const [subTab, setSubTab] = useState('djeca');

  const role = profile?.roles?.value;
  const isOwner = role === 'owner';
  const isTrener = role === 'trener';

  return (
    <div className="ljudi-page">
      <div className="ljudi-pills">
        <button
          className={`ljudi-pill ${subTab === 'djeca' ? 'ljudi-pill--active' : ''}`}
          onClick={() => setSubTab('djeca')}
        >
          Djeca
        </button>
        {!isTrener && (
          <button
            className={`ljudi-pill ${subTab === 'grupe' ? 'ljudi-pill--active' : ''}`}
            onClick={() => setSubTab('grupe')}
          >
            Grupe
          </button>
        )}
        {isOwner && (
          <button
            className={`ljudi-pill ${subTab === 'treneri' ? 'ljudi-pill--active' : ''}`}
            onClick={() => setSubTab('treneri')}
          >
            Treneri
          </button>
        )}
      </div>

      {subTab === 'djeca' && <DjecaView />}
      {subTab === 'grupe' && !isTrener && <GrupeView />}
      {subTab === 'treneri' && isOwner && <TreneriView />}
    </div>
  );
}

export default LjudiPage;
