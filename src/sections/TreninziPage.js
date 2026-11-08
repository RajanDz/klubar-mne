import { useState, useEffect } from 'react';
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

function TrenerView({ coachId }) {
  const { profile } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
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
        setSelectedGroupId(data[0].id);
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
    loadGroupData(selectedGroupId);
  }, [selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadGroupData(groupId) {
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

  /* Toggle inline expand for an existing training */
  function toggleExpand(date) {
    if (expandedDate === date) {
      setExpandedDate(null);
      return;
    }
    setExpandedDate(date);
    setExpandAttendance(buildInitAttendance(date));
    setIsAdding(false);
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
            const isOpen = expandedDate === t.date;

            return (
              <div
                key={t.date}
                className="card card__body"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleExpand(t.date)}
              >
                {/* Card header */}
                <div className="t-training-row">
                  <div>
                    <p className="item-list__name">{formatDate(t.date)}</p>
                    <p className="item-list__meta">{selectedGroup?.name}</p>
                  </div>
                  <span className="t-chip">{t.present}/{t.total}</span>
                </div>

                {/* Inline expand */}
                {isOpen && (
                  <div
                    className="t-expanded"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                        className="btn btn-outline-danger btn-full"
                        onClick={() => handleDelete(t.date)}
                        disabled={saving}
                      >
                        Obriši trening
                      </button>
                      <button
                        className="btn btn-primary btn-full"
                        onClick={() => handleSave(t.date, expandAttendance)}
                        disabled={saving}
                      >
                        {saving ? 'Čuvanje...' : 'Sačuvaj izmjene'}
                      </button>
                    </div>
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
   VlasnikView — for owners
   ============================================================ */

function VlasnikView() {
  const [coaches, setCoaches] = useState([]);
  const [selectedCoachId, setSelectedCoachId] = useState(null);
  const [groupMap, setGroupMap] = useState({});
  const [trainings, setTrainings] = useState([]);
  const [childrenByGroup, setChildrenByGroup] = useState({});
  const [expandedKey, setExpandedKey] = useState(null);
  const [loading, setLoading] = useState(true);

  /* Load coaches on mount */
  useEffect(() => {
    async function loadCoaches() {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, full_name')
        .order('full_name');

      if (error) {
        console.error('Greška pri učitavanju trenera:', error.message);
        setLoading(false);
        return;
      }

      setCoaches(data || []);

      if (data && data.length > 0) {
        setSelectedCoachId(data[0].id);
      } else {
        setLoading(false);
      }
    }

    loadCoaches();
  }, []);

  /* Load data when selected coach changes */
  useEffect(() => {
    if (!selectedCoachId) return;
    loadCoachData(selectedCoachId);
  }, [selectedCoachId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCoachData(coachId) {
    setLoading(true);
    setTrainings([]);
    setExpandedKey(null);

    /* 1. Load groups assigned to this coach */
    const { data: cgData, error: cgError } = await supabase
      .from('coach_groups')
      .select('group_id, groups(id, name)')
      .eq('coach_id', coachId);

    if (cgError) {
      console.error('Greška pri učitavanju grupa trenera:', cgError.message);
      setLoading(false);
      return;
    }

    if (!cgData || cgData.length === 0) {
      setGroupMap({});
      setTrainings([]);
      setChildrenByGroup({});
      setLoading(false);
      return;
    }

    /* Build groupMap: { groupId: groupName } */
    const gMap = {};
    const groupIds = [];
    for (const row of cgData) {
      gMap[row.groups.id] = row.groups.name;
      groupIds.push(row.groups.id);
    }
    setGroupMap(gMap);

    /* 2. Load attendance for all these groups */
    const { data: attData, error: attError } = await supabase
      .from('attendance')
      .select('child_id, date, status, group_id')
      .in('group_id', groupIds);

    if (attError) {
      console.error('Greška pri učitavanju prisustva:', attError.message);
      setLoading(false);
      return;
    }

    /* 3. Load children for all these groups */
    const { data: childData, error: childError } = await supabase
      .from('children_groups')
      .select('child_id, group_id, children(id, full_name)')
      .in('group_id', groupIds);

    if (childError) {
      console.error('Greška pri učitavanju djece:', childError.message);
      setLoading(false);
      return;
    }

    /* 4. Build childrenByGroup: { groupId: [child objects] } */
    const cbg = {};
    for (const row of childData || []) {
      if (!cbg[row.group_id]) cbg[row.group_id] = [];
      cbg[row.group_id].push(row.children);
    }
    setChildrenByGroup(cbg);

    /* 5. Build unique (group_id + date) combos into training cards */
    const seen = new Set();
    const cards = [];

    for (const row of attData || []) {
      const key = `${row.group_id}|${row.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        cards.push({ key, groupId: row.group_id, date: row.date });
      }
    }

    /* For each card, count present/total and build records list */
    const finalCards = cards.map((card) => {
      const records = (attData || []).filter(
        (r) => r.group_id === card.groupId && r.date === card.date
      );
      const present = records.filter((r) => r.status === 'present').length;
      const total = records.length;
      return {
        ...card,
        groupName: gMap[card.groupId] || '',
        present,
        total,
        records,
      };
    });

    /* Sort newest first */
    finalCards.sort((a, b) => (a.date > b.date ? -1 : 1));

    setTrainings(finalCards);
    setLoading(false);
  }

  /* ---- Render ---- */

  if (loading && coaches.length === 0) {
    return <div className="t-loading">Učitavanje...</div>;
  }

  if (coaches.length === 0) {
    return (
      <div className="t-placeholder">Nema evidentiranih trenera u klubu.</div>
    );
  }

  const hasGroups = Object.keys(groupMap).length > 0;

  return (
    <div>
      {/* Coach selector */}
      <div className="t-coach-select">
        <span className="form-label">Odaberi trenera</span>
        <select
          className="form-select t-select-full"
          value={selectedCoachId || ''}
          onChange={(e) => setSelectedCoachId(e.target.value)}
        >
          <option value="" disabled>
            Odaberi trenera
          </option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="t-loading">Učitavanje...</div>
      ) : !hasGroups ? (
        <div className="t-placeholder">Trener nema dodijeljenih grupa.</div>
      ) : trainings.length === 0 ? (
        <div className="t-placeholder">Nema evidentiranih treninga.</div>
      ) : (
        <div className="t-list" style={{ marginTop: 16 }}>
          {trainings.map((t) => {
            const isOpen = expandedKey === t.key;
            const groupChildren = childrenByGroup[t.groupId] || [];

            return (
              <div
                key={t.key}
                className="card card__body"
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  setExpandedKey(isOpen ? null : t.key)
                }
              >
                {/* Card header row */}
                <div className="t-training-row">
                  <div>
                    <p className="item-list__name">{formatDate(t.date)}</p>
                    <p className="item-list__meta">{t.groupName}</p>
                  </div>
                  <span className="t-chip">
                    {t.present}/{t.total}
                  </span>
                </div>

                {/* Expanded: children list */}
                {isOpen && (
                  <div className="t-expanded">
                    {groupChildren.map((child) => {
                      const record = t.records.find(
                        (r) => r.child_id === child.id
                      );
                      const isPresent = record && record.status === 'present';
                      return (
                        <div key={child.id} className="t-owner-row">
                          <span>{child.full_name}</span>
                          {isPresent ? (
                            <span className="t-mark-present">✓</span>
                          ) : (
                            <span className="t-mark-absent">✗</span>
                          )}
                        </div>
                      );
                    })}
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
   PrisustvoTab — djeca sa 5+ uzastopnih izostanaka
   ============================================================ */

function PrisustvoTab() {
  const { profile } = useAuth();
  const isTrener = profile?.roles?.value === 'trener';

  const [warnings, setWarnings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { loadWarnings(); }, []); // eslint-disable-line

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
        childName: row.children?.full_name ?? '',
        groupName: row.groups?.name ?? '',
        records: [],
      };
      grouped[key].records.push(row);
    }

    const result = [];
    for (const { childName, groupName, records } of Object.values(grouped)) {
      let count = 0;
      for (const r of records) {
        if (r.status !== 'present') count++;
        else break;
      }
      if (count >= 5) result.push({ childName, groupName, count });
    }

    result.sort((a, b) => b.count - a.count);
    setWarnings(result);
    setLoading(false);
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
          {warnings.map((w, i) => (
            <li
              key={`${w.childName}|${w.groupName}`}
              className={`att-warn-row ${i < warnings.length - 1 ? 'att-warn-row--sep' : ''}`}
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
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/* ============================================================
   TreninziPage — top-level with sub-pills
   ============================================================ */

function TreninziPage() {
  const { profile } = useAuth();
  const [subTab, setSubTab] = useState('treninzi');

  const isOwner  = profile?.roles?.value === 'owner';
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
          className={`t-pill ${subTab === 'prisustvo' ? 't-pill--active' : ''}`}
          onClick={() => setSubTab('prisustvo')}
        >
          Prisustvo
        </button>
      </div>

      {subTab === 'prisustvo' ? (
        <PrisustvoTab />
      ) : isOwner ? (
        <VlasnikView />
      ) : isTrener ? (
        <TrenerView coachId={profile.coach_id} />
      ) : (
        <TrenerView />
      )}
    </div>
  );
}

export default TreninziPage;
