import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/* ============================================================
   Helpers
   ============================================================ */

function getInitials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('');
}

function nameHue(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++)
    h = (name.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h) % 360;
}

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ymToPeriod(ym) { return `${ym}-01`; }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const s = new Date(ym + '-01T00:00:00')
    .toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmt(n) {
  const v = parseFloat(n) || 0;
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2);
}

/* ============================================================
   PaymentToggle
   ============================================================ */

function PaymentToggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`pay-toggle ${on ? 'pay-toggle--on' : ''}`}
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      aria-pressed={on}
    >
      <span className="pay-toggle__knob" />
    </button>
  );
}

/* ============================================================
   ClanarinaTab
   ============================================================ */

function ClanarinaTab() {
  const { profile } = useAuth();
  const isOwner  = profile?.roles?.value === 'owner';
  const isTrener = profile?.roles?.value === 'trener';

  const [groups,          setGroups]          = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedMonth,   setSelectedMonth]   = useState(currentYM());

  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('svi');
  const [savingKey, setSavingKey] = useState(null);

  const [clubFee,       setClubFee]       = useState(profile?.clubs?.fee ?? null);
  const [clubFeeInput,  setClubFeeInput]  = useState(
    profile?.clubs?.fee != null ? String(profile.clubs.fee) : ''
  );
  const [savingClubFee, setSavingClubFee] = useState(false);

  /* ---- Učitavanje grupa ---- */

  useEffect(() => { loadGroups(); }, []); // eslint-disable-line

  async function loadGroups() {
    if (isTrener) {
      const { data } = await supabase
        .from('coach_groups')
        .select('group_id, groups(id, name, fee)')
        .eq('coach_id', profile.coach_id);
      const grps = (data || []).map(r => r.groups).filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, 'sr'));
      setGroups(grps);
    } else {
      const { data } = await supabase
        .from('groups').select('id, name, fee').order('name');
      setGroups(data || []);
    }
  }

  /* ---- Učitavanje redova (djeca + članarine) ---- */

  useEffect(() => {
    loadRows();
  }, [selectedGroupId, selectedMonth, groups]); // eslint-disable-line

  async function loadRows() {
    if (groups.length === 0) { setRows([]); setLoading(false); return; }

    setLoading(true);
    setError('');

    const groupIds = selectedGroupId ? [selectedGroupId] : groups.map(g => g.id);

    const [cgRes, memRes] = await Promise.all([
      supabase.from('children_groups')
        .select('child_id, group_id, children(id, full_name, fee, arch, parent_name), groups(id, name, fee)')
        .in('group_id', groupIds),
      supabase.from('memberships')
        .select('id, child_id, group_id, amount, status, payment_date, handover_id, coach_id')
        .in('group_id', groupIds)
        .eq('period', ymToPeriod(selectedMonth)),
    ]);

    if (cgRes.error) { setError('Nije moguće učitati djecu.'); setLoading(false); return; }

    const activeLinks = (cgRes.data || []).filter(cg => !cg.children?.arch);

    const memMap = {};
    for (const m of memRes.data || [])
      memMap[`${m.child_id}|${m.group_id}`] = m;

    const groupFeeMap = {};
    for (const g of groups) groupFeeMap[g.id] = g.fee;

    const builtRows = activeLinks.map(cg => ({
      key:        `${cg.child_id}|${cg.group_id}`,
      childId:    cg.child_id,
      groupId:    cg.group_id,
      childName:  cg.children?.full_name ?? '',
      parentName: cg.children?.parent_name ?? '',
      groupName:  cg.groups?.name ?? '',
      defaultFee: cg.children?.fee ?? cg.groups?.fee ?? groupFeeMap[cg.group_id] ?? clubFee ?? 0,
      membership: memMap[`${cg.child_id}|${cg.group_id}`] ?? null,
    }));

    builtRows.sort((a, b) => a.childName.localeCompare(b.childName, 'sr'));
    setRows(builtRows);
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

  /* ---- Toggle uplata ---- */

  async function handleToggle(row, newValue) {
    if (savingKey) return;
    if (row.membership?.handover_id) return;
    setSavingKey(row.key);

    if (newValue) {
      if (row.membership) {
        const { data, error: e } = await supabase.from('memberships')
          .update({ status: 'paid', payment_date: todayISO() })
          .eq('id', row.membership.id)
          .select('id, child_id, group_id, amount, status, payment_date, handover_id, coach_id')
          .single();
        if (!e) setRows(prev => prev.map(r => r.key === row.key ? { ...r, membership: data } : r));
      } else {
        const { data, error: e } = await supabase.from('memberships').insert({
          club_id:      profile.club_id,
          child_id:     row.childId,
          group_id:     row.groupId,
          period:       ymToPeriod(selectedMonth),
          status:       'paid',
          amount:       row.defaultFee,
          payment_date: todayISO(),
          coach_id:     isTrener ? profile.coach_id : null,
        }).select('id, child_id, group_id, amount, status, payment_date, handover_id, coach_id').single();
        if (!e) setRows(prev => prev.map(r => r.key === row.key ? { ...r, membership: data } : r));
      }
    } else {
      if (row.membership) {
        await supabase.from('memberships').delete().eq('id', row.membership.id);
        setRows(prev => prev.map(r => r.key === row.key ? { ...r, membership: null } : r));
      }
    }

    setSavingKey(null);
  }

  /* ---- Izmjena iznosa ---- */

  async function handleAmountBlur(row, rawValue) {
    const amount = parseFloat(rawValue);
    if (!row.membership || isNaN(amount) || amount === parseFloat(row.membership.amount)) return;
    if (row.membership.handover_id) return;
    setSavingKey(row.key);
    await supabase.from('memberships').update({ amount }).eq('id', row.membership.id);
    setRows(prev => prev.map(r =>
      r.key === row.key ? { ...r, membership: { ...r.membership, amount } } : r
    ));
    setSavingKey(null);
  }

  /* ---- Osnovna cijena kluba (samo vlasnik) ---- */

  async function handleClubFeeBlur() {
    const val = clubFeeInput.trim();
    const newFee = val === '' ? null : parseFloat(val);
    if (newFee === clubFee || (val !== '' && isNaN(newFee))) return;
    setSavingClubFee(true);
    await supabase.from('clubs').update({ fee: newFee }).eq('id', profile.clubs?.id);
    setClubFee(newFee);
    setSavingClubFee(false);
  }

  /* ---- Izračunate vrijednosti ---- */

  const paidRows  = rows.filter(r => r.membership?.status === 'paid');
  const paidCount = paidRows.length;
  const collected = paidRows.reduce((s, r) => s + (parseFloat(r.membership.amount) || 0), 0);
  const total     = rows.length;
  const pct       = total > 0 ? Math.round((paidCount / total) * 100) : 0;

  const showGroupCol = selectedGroupId === '';

  const visibleRows = rows.filter(r => {
    if (filter === 'platili' && r.membership?.status !== 'paid') return false;
    if (filter === 'nisu'    && r.membership?.status === 'paid')  return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!r.childName.toLowerCase().includes(q) &&
          !r.parentName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  /* ---- Render ---- */

  return (
    <div className="cla-tab">

      {/* Navigacija po mjesecima */}
      <div className="cla-month-nav">
        <button className="cla-month-btn" onClick={prevMonth} aria-label="Prethodni mjesec">‹</button>
        <span className="cla-month-label">{monthLabel(selectedMonth)}</span>
        <button className="cla-month-btn" onClick={nextMonth} aria-label="Sljedeći mjesec">›</button>
      </div>

      {/* Filteri */}
      <div className="cla-filters">
        <select
          className="form-select"
          value={selectedGroupId}
          onChange={e => setSelectedGroupId(e.target.value)}
        >
          <option value="">Sve grupe</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <input
          className="form-input"
          type="search"
          placeholder="Pretraga po imenu ili roditelju..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {isOwner && (
          <div className="cla-fee-row">
            <label className="form-label" htmlFor="club-base-fee">
              Osnovna članarina (€)
            </label>
            <input
              id="club-base-fee"
              className="form-input cla-fee-input"
              type="number"
              min="0"
              step="0.01"
              value={clubFeeInput}
              onChange={e => setClubFeeInput(e.target.value)}
              onBlur={handleClubFeeBlur}
              disabled={savingClubFee}
              placeholder="—"
            />
          </div>
        )}
      </div>

      {/* Status pills */}
      <div className="cla-status-pills">
        {[['svi', 'Svi'], ['platili', 'Platili'], ['nisu', 'Nisu platili']].map(([val, label]) => (
          <button
            key={val}
            className={`cla-status-pill ${filter === val ? 'cla-status-pill--active' : ''}`}
            onClick={() => setFilter(val)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-secondary">Učitavanje...</p>
      ) : error ? (
        <div>
          <p className="text-error">{error}</p>
          <button className="btn btn-secondary" onClick={loadRows}>Pokušaj ponovo</button>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p className="empty-state__title">
              {rows.length === 0
                ? 'Nema aktivnih članova u odabranoj grupi.'
                : 'Nema rezultata za odabrani filter.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <ul className="cla-list">
            {visibleRows.map((row, i) => {
              const isPaid          = row.membership?.status === 'paid';
              const inHandover      = !!row.membership?.handover_id;
              const ownerPaid       = isTrener && !!row.membership && row.membership.coach_id !== profile.coach_id;
              const isLocked        = inHandover || ownerPaid;
              const isSaving        = savingKey === row.key;
              const amount   = isPaid ? parseFloat(row.membership.amount) : row.defaultFee;

              return (
                <li
                  key={row.key}
                  className={`cla-row ${i < visibleRows.length - 1 ? 'cla-row--sep' : ''} ${isLocked ? 'cla-row--locked' : ''}`}
                >
                  <div
                    className="cla-initials"
                    style={{ background: `hsl(${nameHue(row.childName)},45%,42%)` }}
                  >
                    {getInitials(row.childName)}
                  </div>

                  <div className="cla-row__body">
                    <div className="cla-row__name-line">
                      <span className="cla-row__name">{row.childName}</span>
                      {isPaid && !isLocked && (
                        <>
                          <input
                            className="cla-row__amount-input"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={parseFloat(row.membership.amount) || 0}
                            key={`${row.membership.id}-${row.membership.amount}`}
                            onBlur={e => handleAmountBlur(row, e.target.value)}
                            disabled={isSaving}
                            onClick={e => e.stopPropagation()}
                          />
                          <span className="cla-row__amount-eur">€</span>
                        </>
                      )}
                      {isPaid && isLocked && (
                        <span className="cla-row__amount-locked">{fmt(amount)} €</span>
                      )}
                    </div>

                    <span className={`cla-row__status ${isPaid ? 'cla-row__status--paid' : 'cla-row__status--unpaid'}`}>
                      {isPaid
                        ? `plaćeno ${fmt(amount)} €`
                        : `nije plaćeno · ${fmt(row.defaultFee)} €`}
                    </span>

                    {showGroupCol && (
                      <span className="cla-row__group">{row.groupName}</span>
                    )}

                    {inHandover && (
                      <span className="cla-row__locked-msg">
                        Uplata je dio predaje u toku — ne može se poništiti.
                      </span>
                    )}
                    {ownerPaid && (
                      <span className="cla-row__locked-msg">
                        Uplatu je evidentirao vlasnik.
                      </span>
                    )}
                  </div>

                  <PaymentToggle
                    on={isPaid}
                    onChange={val => handleToggle(row, val)}
                    disabled={isSaving || isLocked}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Sažetak */}
      {!loading && rows.length > 0 && (
        <div className="cla-summary">
          <div className="cla-progress">
            <div className="cla-progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="cla-summary__text">
            Plaćeno {paidCount} od {total}. Prikupljeno: {fmt(collected)} €
          </p>
        </div>
      )}

    </div>
  );
}

export default ClanarinaTab;
