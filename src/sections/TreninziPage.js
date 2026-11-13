import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './TreninziPage.css';

/* ============================================================
   Helper functions
   ============================================================ */

function todayISO() {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}.`;
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function nameHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
}

/* ============================================================
   Small reusable components
   ============================================================ */

function InitialsCircle({ name }) {
  const hue = nameHue(name);
  return (
    <div className="t-initials" style={{ background: `hsl(${hue},45%,42%)` }}>
      {getInitials(name)}
    </div>
  );
}

function AttendanceToggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`t-toggle ${on ? 't-toggle--on' : ''}`}
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      aria-pressed={on}
    >
      <span className="t-toggle__knob" />
    </button>
  );
}

/* ============================================================
   TrenerView — for coordinators/coaches
   ============================================================ */

function TrenerView({ coachId, initialGroupId = null }) {
  const { profile } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const shouldAutoOpen = useRef(false);
  const [children, setChildren] = useState([]);
  const [treninzi, setTreninzi] = useState({});
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Add-form state */
  const [isAdding, setIsAdding] = useState(false);
  const [addDate, setAddDate] = useState(todayISO());
  const [addAttendance, setAddAttendance] = useState({});

  /* Inline-expand state for existing trainings */
  const [expandedDate, setExpandedDate] = useState(null);
  const [editingDate, setEditingDate] = useState(null);
  const [expandAttendance, setExpandAttendance] = useState({});

  /* Load groups on mount — filtered by coach if coachId is provided */
  useEffect(() => {
    async function loadGroups() {
      setLoadingGroups(true);

      let data, error;

      if (coachId) {
        const result = await supabase
          .from('coach_groups')
          .select('group_id, groups(id, name)')
          .eq('coach_id', coachId)
          .order('groups(name)');
        data = (result.data || []).map((row) => row.groups);
        error = result.error;
      } else {
        const result = await supabase
          .from('groups')
          .select('id, name')
          .order('name');
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Greška pri učitavanju grupa:', error.message);
        setLoadingGroups(false);
        return;
      }

      setGroups(data || []);

      if (data && data.length > 0) {
        const preselect = initialGroupId && data.find(g => g.id === initialGroupId);
        if (preselect) shouldAutoOpen.current = true;
        setSelectedGroupId(preselect ? initialGroupId : data[0].id);
      }

      setLoadingGroups(false);
    }

    loadGroups();
  }, [coachId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Load children + attendance when selected group changes */
  useEffect(() => {
    if (!selectedGroupId) return;
    setIsAdding(false);
    setExpandedDate(null);
    setEditingDate(null);
    const openForm = shouldAutoOpen.current;
    shouldAutoOpen.current = false;
    loadGroupData(selectedGroupId, openForm);
  }, [selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadGroupData(groupId, openAddForm = false) {
    setLoadingData(true);

    const { data: cgData, error: cgError } = await supabase
      .from('children_groups')
      .select('child_id, children(id, full_name)')
      .eq('group_id', groupId);

    if (cgError) {
      console.error('Greška pri učitavanju djece:', cgError.message);
      setLoadingData(false);
      return;
    }

    const loadedChildren = (cgData || []).map((row) => row.children);
    setChildren(loadedChildren);

    const { data: attData, error: attError } = await supabase
      .from('attendance')
      .select('child_id, date, status')
      .eq('group_id', groupId);

    if (attError) {
      console.error('Greška pri učitavanju prisustva:', attError.message);
      setLoadingData(false);
      return;
    }

    const map = {};
    for (const row of attData || []) {
      const key = `${groupId}|${row.date}`;
      if (!map[key]) map[key] = {};
      map[key][row.child_id] = row.status === 'present';
    }

    setTreninzi((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`${groupId}|`)) delete next[k];
      });
      return { ...next, ...map };
    });

    setLoadingData(false);

    if (openAddForm) {
      const today = todayISO();
      const init = {};
      loadedChildren.forEach(c => { init[c.id] = false; });
      const todayKey = `${groupId}|${today}`;
      if (map[todayKey]) Object.assign(init, map[todayKey]);
      setAddDate(today);
      setAddAttendance(init);
      setIsAdding(true);
      setExpandedDate(null);
    }
  }

  function getTrainingList() {
    if (!selectedGroupId) return [];

    const prefix = `${selectedGroupId}|`;
    const dates = Object.keys(treninzi)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.replace(prefix, ''));

    dates.sort((a, b) => (a > b ? -1 : 1));

    return dates.map((date) => {
      const records = treninzi[`${selectedGroupId}|${date}`];
      const total = Object.keys(records).length;
      const present = Object.values(records).filter(Boolean).length;
      return { date, present, total };
    });
  }

  function buildInitAttendance(date) {
    const init = {};
    children.forEach((c) => { init[c.id] = false; });
    const key = `${selectedGroupId}|${date}`;
    if (treninzi[key]) Object.assign(init, treninzi[key]);
    return init;
  }

  /* Open the add-form */
  function startAdding() {
    const today = todayISO();
    setAddDate(today);
    setAddAttendance(buildInitAttendance(today));
    setIsAdding(true);
    setExpandedDate(null);
  }

  function handleAddDateChange(date) {
    setAddDate(date);
    setAddAttendance(buildInitAttendance(date));
  }

  /* Toggle inline expand for an existing training (read-only view) */
  function toggleExpand(date) {
    if (expandedDate === date) {
      setExpandedDate(null);
      setEditingDate(null);
      return;
    }
    setExpandedDate(date);
    setEditingDate(null);
    setIsAdding(false);
  }

  /* Switch expanded card into edit mode */
  function startEditing(date) {
    setEditingDate(date);
    setExpandAttendance(buildInitAttendance(date));
  }

  /* Save attendance (used for both add and edit) */
  async function handleSave(date, attendance) {
    if (!selectedGroupId || !date) return;
    setSaving(true);

    const rows = children.map((c) => ({
      club_id: profile.club_id,
      group_id: selectedGroupId,
      child_id: c.id,
      date,
      status: attendance[c.id] ? 'present' : 'absent',
    }));

    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'child_id,group_id,date' });

    if (error) {
      console.error('Greška pri čuvanju:', error.message);
      setSaving(false);
      return;
    }

    await loadGroupData(selectedGroupId);
    setIsAdding(false);
    setExpandedDate(null);
    setEditingDate(null);
    setSaving(false);
  }

  /* Delete an entire training */
  async function handleDelete(date) {
    if (!selectedGroupId || !date) return;
    if (!window.confirm(`Obrisati trening od ${formatDate(date)}? Ova radnja se ne može poništiti.`)) return;

    setSaving(true);

    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('group_id', selectedGroupId)
      .eq('date', date);

    if (error) {
      console.error('Greška pri brisanju:', error.message);
      setSaving(false);
      return;
    }

    await loadGroupData(selectedGroupId);
    setExpandedDate(null);
    setEditingDate(null);
    setSaving(false);
  }

  /* ---- Render ---- */

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const trainingList = getTrainingList();

  if (loadingGroups) {
    return <div className="t-loading">Učitavanje...</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="t-placeholder">
        {coachId
          ? 'Nemate dodijeljenih grupa. Kontaktirajte koordinatora kluba.'
          : 'Nema dostupnih grupa. Dodajte grupu u sekciji Grupe.'}
      </div>
    );
  }

  return (
    <div>
      {/* Group selector + add button */}
      <div className="t-controls">
        <select
          className="form-select t-select-full"
          value={selectedGroupId || ''}
          onChange={(e) => setSelectedGroupId(e.target.value)}
        >
          <option value="" disabled>Odaberi grupu</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        <button
          className="btn btn-primary btn-full"
          onClick={startAdding}
          disabled={isAdding}
        >
          Dodaj trening
        </button>
      </div>

      {/* Inline add-form */}
      {isAdding && (
        <div className="card card__body t-add-card">
          <p className="t-form-title">Novi trening</p>
          <p className="t-form-subtitle">{selectedGroup?.name}</p>

          <input
            type="date"
            className="form-input"
            value={addDate}
            onChange={(e) => handleAddDateChange(e.target.value)}
          />

          <hr className="divider" />

          {children.length === 0 ? (
            <div className="t-placeholder">Nema djece u ovoj grupi.</div>
          ) : (
            <>
              {children.map((child) => (
                <div key={child.id} className="t-child-row">
                  <InitialsCircle name={child.full_name} />
                  <span className="t-child-name">{child.full_name}</span>
                  <AttendanceToggle
                    on={!!addAttendance[child.id]}
                    onChange={(val) =>
                      setAddAttendance((prev) => ({ ...prev, [child.id]: val }))
                    }
                    disabled={saving}
                  />
                </div>
              ))}
              <div className="t-summary">
                Došlo: {Object.values(addAttendance).filter(Boolean).length} od {children.length}
              </div>
            </>
          )}

          <div className="t-form-actions">
            <button
              className="btn btn-secondary btn-full"
              onClick={() => setIsAdding(false)}
              disabled={saving}
            >
              Odustani
            </button>
            <button
              className="btn btn-primary btn-full"
              onClick={() => handleSave(addDate, addAttendance)}
              disabled={saving || children.length === 0}
            >
              {saving ? 'Čuvanje...' : 'Sačuvaj trening'}
            </button>
          </div>
        </div>
      )}

      {/* Training list */}
      <p className="t-section-title" style={{ marginTop: 8 }}>Održani treninzi</p>

      {loadingData ? (
        <div className="t-loading">Učitavanje...</div>
      ) : trainingList.length === 0 ? (
        <div className="card card__body">
          <div className="t-placeholder">Još nema treninga za ovu grupu.</div>
        </div>
      ) : (
        <div className="t-list">
          {trainingList.map((t) => {
            const isOpen    = expandedDate === t.date;
            const isEditing = editingDate  === t.date;

            return (
              <div
                key={t.date}
                className="card card__body"
                style={{ cursor: isEditing ? 'default' : 'pointer' }}
                onClick={() => !isEditing && toggleExpand(t.date)}
              >
                {/* Card header */}
                <div className="t-training-row">
                  <div>
                    <p className="item-list__name">{formatDate(t.date)}</p>
                    <p className="item-list__meta">{selectedGroup?.name}</p>
                  </div>
                  <span className="t-chip">{t.present}/{t.total}</span>
                </div>

                {/* View mode: read-only ✓/✗ + Uredi dugme */}
                {isOpen && !isEditing && (
                  <div className="t-expanded" onClick={(e) => e.stopPropagation()}>
                    {children.map((child) => {
                      const isPresent = !!(treninzi[`${selectedGroupId}|${t.date}`]?.[child.id]);
                      return (
                        <div key={child.id} className="t-child-row">
                          <InitialsCircle name={child.full_name} />
                          <span className="t-child-name">{child.full_name}</span>
                          {isPresent
                            ? <span className="t-mark-present">✓</span>
                            : <span className="t-mark-absent">✗</span>
                          }
                        </div>
                      );
                    })}
                    <div className="t-form-actions" style={{ marginTop: 12 }}>
                      <button
                        className="btn btn-secondary btn-full"
                        onClick={() => startEditing(t.date)}
                      >
                        Uredi prisustvo
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit mode: toggles + Sačuvaj/Odustani/Obriši */}
                {isEditing && (
                  <div className="t-expanded" onClick={(e) => e.stopPropagation()}>
                    {children.map((child) => (
                      <div key={child.id} className="t-child-row">
                        <InitialsCircle name={child.full_name} />
                        <span className="t-child-name">{child.full_name}</span>
                        <AttendanceToggle
                          on={!!expandAttendance[child.id]}
                          onChange={(val) =>
                            setExpandAttendance((prev) => ({ ...prev, [child.id]: val }))
                          }
                          disabled={saving}
                        />
                      </div>
                    ))}

                    <div className="t-summary">
                      Došlo: {Object.values(expandAttendance).filter(Boolean).length} od {children.length}
                    </div>

                    <div className="t-form-actions">
                      <button
                        className="btn btn-secondary btn-full"
                        onClick={() => setEditingDate(null)}
                        disabled={saving}
                      >
                        Odustani
                      </button>
                      <button
                        className="btn btn-primary btn-full"
                        onClick={() => handleSave(t.date, expandAttendance)}
                        disabled={saving}
                      >
                        {saving ? 'Čuvanje...' : 'Sačuvaj izmjene'}
                      </button>
                    </div>

                    <button
                      className="btn btn-outline-danger btn-full"
                      style={{ marginTop: 8 }}
                      onClick={() => handleDelete(t.date)}
                      disabled={saving}
                    >
                      Obriši trening
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   UpozenjaTab — djeca sa 5+ uzastopnih izostanaka
   ============================================================ */

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

function UpozenjaTab() {
  const { profile } = useAuth();
  const isTrener = profile?.roles?.value === 'trener';

  const [warnings,     setWarnings]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [expandedKey,  setExpandedKey]  = useState(null);
  const [expandedCid,  setExpandedCid]  = useState(null);
  const [selectedMonth,setSelectedMonth]= useState(currentYM);
  const [monthData,    setMonthData]    = useState([]);
  const [loadingMonth, setLoadingMonth] = useState(false);

  useEffect(() => { loadWarnings(); }, []); // eslint-disable-line

  useEffect(() => {
    if (!expandedCid) return;
    fetchMonthData(expandedCid, selectedMonth);
  }, [expandedCid, selectedMonth]); // eslint-disable-line

  async function loadWarnings() {
    setLoading(true);

    let groupIds;
    if (isTrener) {
      const { data } = await supabase
        .from('coach_groups')
        .select('group_id')
        .eq('coach_id', profile.coach_id);
      groupIds = (data || []).map(r => r.group_id);
    } else {
      const { data } = await supabase.from('groups').select('id');
      groupIds = (data || []).map(r => r.id);
    }

    if (groupIds.length === 0) { setWarnings([]); setLoading(false); return; }

    const { data: attData } = await supabase
      .from('attendance')
      .select('child_id, group_id, date, status, children(full_name), groups(name)')
      .in('group_id', groupIds)
      .order('date', { ascending: false });

    const grouped = {};
    for (const row of attData || []) {
      const key = `${row.child_id}|${row.group_id}`;
      if (!grouped[key]) grouped[key] = {
        childId:   row.child_id,
        groupId:   row.group_id,
        childName: row.children?.full_name ?? '',
        groupName: row.groups?.name ?? '',
        records:   [],
      };
      grouped[key].records.push(row);
    }

    const result = [];
    for (const { childId, groupId, childName, groupName, records } of Object.values(grouped)) {
      let count = 0;
      for (const r of records) {
        if (r.status !== 'present') count++;
        else break;
      }
      if (count >= 5) result.push({ childId, groupId, childName, groupName, count });
    }

    result.sort((a, b) => b.count - a.count);
    setWarnings(result);
    setLoading(false);
  }

  async function fetchMonthData(childId, month) {
    setLoadingMonth(true);
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const { data } = await supabase
      .from('attendance')
      .select('date, status, groups(name)')
      .eq('child_id', childId)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-${String(lastDay).padStart(2, '0')}`)
      .order('date', { ascending: false });
    setMonthData(data || []);
    setLoadingMonth(false);
  }

  function toggleExpand(key, childId) {
    if (expandedKey === key) {
      setExpandedKey(null);
      setExpandedCid(null);
    } else {
      setExpandedKey(key);
      setExpandedCid(childId);
      setSelectedMonth(currentYM());
    }
  }

  if (loading) return <p className="text-secondary">Učitavanje...</p>;

  if (warnings.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <p className="empty-state__title">Nema upozorenja. Sva djeca redovno dolaze na treninge.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="t-section-title">Djeca sa 5+ uzastopnih izostanaka</p>
      <div className="card">
        <ul className="att-warn-list">
          {warnings.map((w, i) => {
            const key      = `${w.childId}|${w.groupId}`;
            const isOpen   = expandedKey === key;
            const isLast   = i === warnings.length - 1;

            return (
              <li key={key} className={`att-warn-row ${!isLast || isOpen ? 'att-warn-row--sep' : ''}`}>

                {/* ── Clickable header ── */}
                <div
                  className={`att-warn-row__header ${isOpen ? 'att-warn-row__header--active' : ''}`}
                  onClick={() => toggleExpand(key, w.childId)}
                >
                  <div
                    className="t-initials"
                    style={{ background: `hsl(${nameHue(w.childName)},45%,42%)` }}
                  >
                    {getInitials(w.childName)}
                  </div>
                  <div className="att-warn-body">
                    <span className="att-warn-name">{w.childName}</span>
                    <span className="att-warn-group">{w.groupName}</span>
                  </div>
                  <span className="att-warn-badge">{w.count} uzastopnih</span>
                  <span className="att-warn-chevron">{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* ── Inline detail panel ── */}
                {isOpen && (
                  <div className="att-detail">
                    <div className="att-month-nav">
                      <button className="att-month-btn" onClick={() => setSelectedMonth(s => shiftMonth(s, -1))}>‹</button>
                      <span className="att-month-label">{formatMonthLabel(selectedMonth)}</span>
                      <button className="att-month-btn" onClick={() => setSelectedMonth(s => shiftMonth(s, 1))}>›</button>
                    </div>

                    {loadingMonth ? (
                      <p className="att-detail__empty">Učitavanje...</p>
                    ) : monthData.length === 0 ? (
                      <p className="att-detail__empty">Nema treninga u ovom periodu.</p>
                    ) : (
                      <ul className="att-detail__list">
                        {monthData.map(r => (
                          <li key={r.date} className="att-detail__row">
                            <span className="att-detail__date">{formatShortDate(r.date)}</span>
                            <span className="att-detail__group">{r.groups?.name ?? ''}</span>
                            <span className={r.status === 'present' ? 'att-mark-yes' : 'att-mark-no'}>
                              {r.status === 'present' ? '✓' : '✗'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

/* ============================================================
   TreninziPage — top-level with sub-pills
   ============================================================ */

function TreninziPage({ initialGroupId = null }) {
  const { profile } = useAuth();
  const [subTab, setSubTab] = useState('treninzi');

  const isTrener = profile?.roles?.value === 'trener';

  return (
    <div className="t-page">
      <div className="t-pills">
        <button
          className={`t-pill ${subTab === 'treninzi' ? 't-pill--active' : ''}`}
          onClick={() => setSubTab('treninzi')}
        >
          Treninzi
        </button>
        <button
          className={`t-pill ${subTab === 'upozorenja' ? 't-pill--active' : ''}`}
          onClick={() => setSubTab('upozorenja')}
        >
          Upozorenja
        </button>
      </div>

      {subTab === 'upozorenja' ? (
        <UpozenjaTab />
      ) : isTrener ? (
        <TrenerView coachId={profile.coach_id} initialGroupId={initialGroupId} />
      ) : (
        <TrenerView initialGroupId={initialGroupId} />
      )}
    </div>
  );
}

export default TreninziPage;
