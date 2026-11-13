import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import './DjecaPage.css';

/* ---- Attendance helpers ---- */

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatShortDate(iso) {
  const [, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
  return `${parseInt(d)}. ${months[parseInt(m) - 1]}`;
}

function ChildAttendance({ childId }) {
  const [selectedMonth, setSelectedMonth] = useState(currentYM);
  const [monthData, setMonthData]         = useState([]);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    setLoading(true);
    const [y, m] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    supabase
      .from('attendance')
      .select('date, status, groups(name)')
      .eq('child_id', childId)
      .gte('date', `${selectedMonth}-01`)
      .lte('date', `${selectedMonth}-${String(lastDay).padStart(2, '0')}`)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setMonthData(data || []);
        setLoading(false);
      });
  }, [childId, selectedMonth]);

  return (
    <div className="card">
      <div className="card__body">
        <p className="dj-att-title">Prisustvo na treninzima</p>

        <div className="dj-month-nav">
          <button className="dj-month-btn" onClick={() => setSelectedMonth(s => shiftMonth(s, -1))}>‹</button>
          <span className="dj-month-label">{formatMonthLabel(selectedMonth)}</span>
          <button className="dj-month-btn" onClick={() => setSelectedMonth(s => shiftMonth(s, 1))}>›</button>
        </div>

        {loading ? (
          <p className="dj-att-empty">Učitavanje...</p>
        ) : monthData.length === 0 ? (
          <p className="dj-att-empty">Nema treninga u ovom periodu.</p>
        ) : (
          <ul className="dj-att-list">
            {monthData.map(r => (
              <li key={r.date} className="dj-att-row">
                <span className="dj-att-date">{formatShortDate(r.date)}</span>
                <span className="dj-att-group">{r.groups?.name ?? ''}</span>
                <span className={r.status === 'present' ? 'dj-att-mark dj-att-mark--yes' : 'dj-att-mark dj-att-mark--no'}>
                  {r.status === 'present' ? '✓' : '✗'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---- Profile date formatter ---- */

function formatDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}.`;
}

function DjecaPage() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedChild, setSelectedChild] = useState(null);

  useEffect(() => {
    loadChildren();
  }, []);

  async function loadChildren() {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('children')
      .select(`
        id, full_name, date_of_birth, parent_name, parent_phone, created_at,
        children_groups ( group_id, groups ( id, name ) )
      `)
      .order('full_name', { ascending: true });

    if (fetchError) {
      setError('Nije moguće učitati djecu. Pokušajte ponovo.');
    } else {
      setChildren(data);
    }

    setLoading(false);
  }

  if (loading) {
    return <p className="text-secondary">Učitavanje djece...</p>;
  }

  if (error) {
    return (
      <div>
        <p className="text-error">{error}</p>
        <button className="btn btn-secondary" onClick={loadChildren}>
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  if (selectedChild) {
    return (
      <div className="djeca-page">
        <div className="page-header">
          <div>
            <button
              className="btn btn-ghost djeca-back-btn"
              onClick={() => setSelectedChild(null)}
            >
              ← Nazad
            </button>
            <h2 className="page-header__title">{selectedChild.full_name}</h2>
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <div className="detail-grid">
              {selectedChild.children_groups?.length > 0 && (
                <div className="detail-field">
                  <span className="detail-label">Grupe</span>
                  <div className="group-tags">
                    {selectedChild.children_groups.map(cg => (
                      <span key={cg.group_id} className="group-tag">
                        {cg.groups?.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedChild.date_of_birth && (
                <div className="detail-field">
                  <span className="detail-label">Datum rođenja</span>
                  <span className="detail-value">{formatDate(selectedChild.date_of_birth)}</span>
                </div>
              )}

              {selectedChild.parent_name && (
                <div className="detail-field">
                  <span className="detail-label">Roditelj / staratelj</span>
                  <span className="detail-value">{selectedChild.parent_name}</span>
                </div>
              )}

              {selectedChild.parent_phone && (
                <div className="detail-field">
                  <span className="detail-label">Kontakt roditelja</span>
                  <span className="detail-value">{selectedChild.parent_phone}</span>
                </div>
              )}

              {!selectedChild.date_of_birth &&
                !selectedChild.parent_name &&
                !selectedChild.parent_phone &&
                selectedChild.children_groups?.length === 0 && (
                  <p className="text-muted">Nema dodatnih podataka za ovog člana.</p>
                )}
            </div>
          </div>
        </div>

        <ChildAttendance childId={selectedChild.id} />
      </div>
    );
  }

  const searchTerm = search.toLowerCase().trim();
  const filtered = searchTerm
    ? children.filter(c =>
        c.full_name?.toLowerCase().includes(searchTerm) ||
        c.parent_name?.toLowerCase().includes(searchTerm) ||
        c.parent_phone?.toLowerCase().includes(searchTerm)
      )
    : children;

  return (
    <div className="djeca-page">
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Djeca</h2>
          <p className="page-header__description">Svi članovi kluba</p>
        </div>
      </div>

      <div className="card">
        <div className="djeca-search">
          <input
            className="form-input"
            type="text"
            placeholder="Pretraga po imenu djeteta ili roditelja..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            {searchTerm ? (
              <>
                <p className="empty-state__title">Nema rezultata</p>
                <p className="empty-state__description">
                  Pokušajte s drugačijim pojmom pretrage.
                </p>
              </>
            ) : (
              <>
                <p className="empty-state__title">Nema djece</p>
                <p className="empty-state__description">
                  Klub još nema evidentiranih članova.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="item-list">
            {filtered.map((child, index) => (
              <li
                key={child.id}
                className={`item-list__row item-list__row--clickable ${index < filtered.length - 1 ? 'item-list__row--separator' : ''}`}
                onClick={() => setSelectedChild(child)}
              >
                <div className="item-list__info">
                  <span className="item-list__name">{child.full_name}</span>
                  {child.parent_name && (
                    <span className="item-list__meta">{child.parent_name}</span>
                  )}
                  {child.children_groups?.length > 0 && (
                    <div className="group-tags">
                      {child.children_groups.map(cg => (
                        <span key={cg.group_id} className="group-tag">
                          {cg.groups?.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="djeca-arrow">›</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DjecaPage;
