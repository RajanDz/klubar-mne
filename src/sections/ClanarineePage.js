import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './ClanarineePage.css';

/* ============================================================
   Helpers
   ============================================================ */

function periodLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const label = d.toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ymToPeriod(ym) {
  return `${ym}-01`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PER_PAGE = 20;

/* ============================================================
   ClanarineePage
   ============================================================ */

function ClanarineePage() {
  const { profile } = useAuth();
  const isTrener = profile?.roles?.value === 'trener';

  const [groups, setGroups]               = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(currentYM());

  const [memberships, setMemberships]     = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  const [page, setPage]                   = useState(1);

  const [showGenForm, setShowGenForm]     = useState(false);
  const [genSaving, setGenSaving]         = useState(false);
  const [genError, setGenError]           = useState('');

  const [saving, setSaving]               = useState({});

  /* ---- Učitavanje podataka ---- */

  useEffect(() => {
    loadGroups();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedGroupId) return;
    loadMemberships();
  }, [selectedGroupId, selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1);
  }, [selectedGroupId, selectedMonth]);

  async function loadGroups() {
    if (isTrener) {
      const { data } = await supabase
        .from('coach_groups')
        .select('group_id, groups(id, name, fee)')
        .eq('coach_id', profile.coach_id);
      const grps = (data || []).map(r => r.groups).filter(Boolean);
      setGroups(grps);
      if (grps.length > 0) setSelectedGroupId(grps[0].id);
    } else {
      const { data } = await supabase
        .from('groups')
        .select('id, name, fee')
        .order('name');
      setGroups(data || []);
      if (data?.length > 0) setSelectedGroupId(data[0].id);
    }
  }

  async function loadMemberships() {
    setLoading(true);
    setError('');

    const { data, error: fetchErr } = await supabase
      .from('memberships')
      .select('id, child_id, amount, status, payment_date, children(id, full_name)')
      .eq('group_id', selectedGroupId)
      .eq('period', ymToPeriod(selectedMonth));

    if (fetchErr) {
      setError('Nije moguće učitati evidenciju.');
      setLoading(false);
      return;
    }

    const sorted = (data || []).sort((a, b) =>
      (a.children?.full_name || '').localeCompare(b.children?.full_name || '', 'sr')
    );
    setMemberships(sorted);
    setLoading(false);
  }

  /* ---- Navigacija po mjesecima ---- */

  function prevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function nextMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  /* ---- Generisanje perioda ---- */

  async function handleGenerate() {
    setGenError('');
    setGenSaving(true);

    const period = ymToPeriod(selectedMonth);
    const group  = groups.find(g => g.id === selectedGroupId);

    const { data: links } = await supabase
      .from('children_groups')
      .select('child_id')
      .eq('group_id', selectedGroupId);

    const childIds = (links || []).map(r => r.child_id);

    if (childIds.length === 0) {
      setGenError('Ova grupa nema ni jednog člana.');
      setGenSaving(false);
      return;
    }

    const { data: activeChildren } = await supabase
      .from('children')
      .select('id, fee')
      .in('id', childIds)
      .eq('arch', false);

    if (!activeChildren || activeChildren.length === 0) {
      setGenError('Ova grupa nema aktivnih članova.');
      setGenSaving(false);
      return;
    }

    const activeIds = activeChildren.map(c => c.id);

    /* Provjeri ko već ima zapis za ovaj period + grupu */
    let existingQuery = supabase
      .from('memberships')
      .select('child_id')
      .eq('group_id', selectedGroupId)
      .eq('period', period)
      .in('child_id', activeIds);

    if (isTrener) {
      existingQuery = existingQuery.eq('coach_id', profile.coach_id);
    }

    const { data: existing } = await existingQuery;
    const existingSet = new Set((existing || []).map(r => r.child_id));
    const toInsert = activeChildren.filter(c => !existingSet.has(c.id));

    if (toInsert.length === 0) {
      setGenError('Svi članovi već imaju evidenciju za ovaj period.');
      setGenSaving(false);
      return;
    }

    /* Za ownera — uzmi prvog dodijeljenog trenera grupe */
    let coachId = isTrener ? profile.coach_id : null;
    if (!isTrener) {
      const { data: cg } = await supabase
        .from('coach_groups')
        .select('coach_id')
        .eq('group_id', selectedGroupId)
        .limit(1)
        .maybeSingle();
      coachId = cg?.coach_id ?? null;
    }

    const rows = toInsert.map(c => ({
      club_id:  profile.club_id,
      child_id: c.id,
      coach_id: coachId,
      group_id: selectedGroupId,
      period,
      amount:   c.fee ?? group?.fee ?? 0,
      status:   'unpaid',
    }));

    const { error: insertErr } = await supabase.from('memberships').insert(rows);

    if (insertErr) {
      setGenError('Greška pri generisanju. Pokušajte ponovo.');
      setGenSaving(false);
      return;
    }

    setShowGenForm(false);
    setGenSaving(false);
    await loadMemberships();
  }

  /* ---- Toggle plaćeno/neplaćeno ---- */

  async function handleToggle(mem) {
    const newStatus = mem.status === 'paid' ? 'unpaid' : 'paid';
    setSaving(p => ({ ...p, [mem.id]: true }));

    await supabase.from('memberships').update({
      status:       newStatus,
      payment_date: newStatus === 'paid' ? todayISO() : null,
    }).eq('id', mem.id);

    setMemberships(prev => prev.map(m =>
      m.id === mem.id
        ? { ...m, status: newStatus, payment_date: newStatus === 'paid' ? todayISO() : null }
        : m
    ));
    setSaving(p => ({ ...p, [mem.id]: false }));
  }

  /* ---- Izmjena iznosa ---- */

  async function handleAmountBlur(mem, rawValue) {
    const amount = parseFloat(rawValue);
    if (isNaN(amount) || amount === parseFloat(mem.amount)) return;

    setSaving(p => ({ ...p, [mem.id]: true }));
    await supabase.from('memberships').update({ amount }).eq('id', mem.id);
    setMemberships(prev => prev.map(m => m.id === mem.id ? { ...m, amount } : m));
    setSaving(p => ({ ...p, [mem.id]: false }));
  }

  /* ---- Izračunate vrijednosti ---- */

  const paidCount  = memberships.filter(m => m.status === 'paid').length;
  const collected  = memberships
    .filter(m => m.status === 'paid')
    .reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);

  const totalPages = Math.max(1, Math.ceil(memberships.length / PER_PAGE));
  const pageStart  = (page - 1) * PER_PAGE;
  const pageMems   = memberships.slice(pageStart, pageStart + PER_PAGE);

  /* ---- Render ---- */

  if (groups.length === 0 && !loading) {
    return (
      <div className="cl-page">
        <p className="text-secondary">
          {isTrener ? 'Nemate dodijeljenih grupa.' : 'Nema dostupnih grupa.'}
        </p>
      </div>
    );
  }

  return (
    <div className="cl-page">

      {/* ---- Navigacija po mjesecima ---- */}
      <div className="cl-month-nav">
        <button className="cl-month-nav__arrow" onClick={prevMonth}>‹</button>
        <span className="cl-month-nav__label">{periodLabel(ymToPeriod(selectedMonth))}</span>
        <button className="cl-month-nav__arrow" onClick={nextMonth}>›</button>
      </div>

      {/* ---- Selektor grupe ---- */}
      {groups.length > 1 && (
        <div className="cl-pills">
          {groups.map(g => (
            <button
              key={g.id}
              className={`cl-pill ${selectedGroupId === g.id ? 'cl-pill--active' : ''}`}
              onClick={() => setSelectedGroupId(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* ---- Summary bar ---- */}
      {selectedGroupId && !loading && !error && (
        <div className="cl-summary-bar">
          <span className="cl-summary-bar__label">
            {memberships.length === 0
              ? 'Nema evidencije'
              : `${paidCount} / ${memberships.length} plaćeno`}
          </span>
          {memberships.length > 0 && (
            <span className="cl-summary-bar__amount">
              {collected % 1 === 0 ? collected.toFixed(0) : collected.toFixed(2)} €
            </span>
          )}
          <button
            className={`btn ${showGenForm ? 'btn-secondary' : 'btn-primary'} cl-gen-btn`}
            onClick={() => { setShowGenForm(p => !p); setGenError(''); }}
          >
            {showGenForm ? '✕ Odustani' : '+ Generiši'}
          </button>
        </div>
      )}

      {/* ---- Forma za generisanje ---- */}
      {showGenForm && (
        <div className="card">
          <div className="card__body cl-gen-confirm">
            <p className="cl-gen-confirm__text">
              Generisati evidenciju za <strong>{periodLabel(ymToPeriod(selectedMonth)).toLowerCase()}</strong>?
              Biće dodani svi aktivni članovi grupe koji već nemaju evidenciju.
            </p>
            {genError && <p className="form-error">{genError}</p>}
            <div className="cl-gen-confirm__actions">
              <button
                className="btn btn-secondary"
                onClick={() => { setShowGenForm(false); setGenError(''); }}
                disabled={genSaving}
              >
                Odustani
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={genSaving}
              >
                {genSaving ? 'Generisanje...' : 'Potvrdi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Sadržaj ---- */}
      {loading ? (
        <p className="text-secondary">Učitavanje...</p>
      ) : error ? (
        <div>
          <p className="text-error">{error}</p>
          <button className="btn btn-secondary" onClick={loadMemberships}>Pokušaj ponovo</button>
        </div>
      ) : memberships.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p className="empty-state__title">Nema evidencije za ovaj period.</p>
            <p className="empty-state__description">
              Klikni "+ Generiši" da kreiraš evidenciju za {periodLabel(ymToPeriod(selectedMonth)).toLowerCase()}.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <ul className="item-list">
              {pageMems.map((mem, i) => (
                <li
                  key={mem.id}
                  className={`item-list__row cl-mem-row ${
                    i < pageMems.length - 1 ? 'item-list__row--separator' : ''
                  }`}
                >
                  <button
                    className={`cl-check ${mem.status === 'paid' ? 'cl-check--paid' : ''}`}
                    onClick={() => handleToggle(mem)}
                    disabled={!!saving[mem.id]}
                    aria-label={mem.status === 'paid' ? 'Plaćeno' : 'Nije plaćeno'}
                  >
                    {mem.status === 'paid' ? '✓' : ''}
                  </button>

                  <span className="cl-mem-name">{mem.children?.full_name}</span>

                  <div className="cl-amount-wrap">
                    <input
                      className="form-input cl-amount-input"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={parseFloat(mem.amount) || 0}
                      key={`${mem.id}-${mem.amount}`}
                      onBlur={e => handleAmountBlur(mem, e.target.value)}
                      disabled={!!saving[mem.id]}
                    />
                    <span className="cl-eur">€</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* ---- Paginacija ---- */}
          {totalPages > 1 && (
            <div className="dj-pagination">
              <div className="dj-pagination__info">
                Prikazano {pageStart + 1}–{Math.min(pageStart + PER_PAGE, memberships.length)} od {memberships.length}
              </div>
              <div className="dj-pagination__controls">
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                >
                  ← Prethodna
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === totalPages}
                >
                  Sljedeća →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ClanarineePage;
