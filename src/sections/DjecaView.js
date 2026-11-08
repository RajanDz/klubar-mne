import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './DjecaView.css';

/* ============================================================
   Helpers
   ============================================================ */

function getInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function nameHue(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) {
    h = (name.charCodeAt(i) + ((h << 5) - h)) | 0;
  }
  return Math.abs(h) % 360;
}

function formatDateDisplay(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}.`;
}

function monthLabel(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' });
}

/* ============================================================
   InitialsCircle — small colored avatar from name
   ============================================================ */

function InitialsCircle({ name, size = 40 }) {
  const hue = nameHue(name);
  return (
    <div
      className="dj-initials"
      style={{
        width: size,
        height: size,
        minWidth: size,
        background: `hsl(${hue},45%,42%)`,
        fontSize: size < 48 ? 13 : 18,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

/* ============================================================
   DjecaView — main component
   ============================================================ */

function DjecaView() {
  const { profile } = useAuth();
  const isOwner = profile?.roles?.value === 'owner';

  /* ---- Data ---- */
  const [children, setChildren] = useState([]);
  const [groups, setGroups] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* ---- List controls ---- */
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [filterGroupId, setFilterGroupId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCoachId, setFilterCoachId] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  /* ---- Views ---- */
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [editingChild, setEditingChild] = useState(null);

  /* ---- Add form state ---- */
  const [addIme, setAddIme] = useState('');
  const [addPrez, setAddPrez] = useState('');
  const [addDob, setAddDob] = useState('');
  const [addTel, setAddTel] = useState('');
  const [addRoditelj, setAddRoditelj] = useState('');
  const [addRtel, setAddRtel] = useState('');
  const [addGroups, setAddGroups] = useState([]);
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const addImeRef = useRef(null);

  /* ---- Edit form state ---- */
  const [editIme, setEditIme] = useState('');
  const [editPrez, setEditPrez] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editTel, setEditTel] = useState('');
  const [editRoditelj, setEditRoditelj] = useState('');
  const [editRtel, setEditRtel] = useState('');
  const [editGroups, setEditGroups] = useState([]);
  const [editFee, setEditFee] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  /* ---- Detail extras ---- */
  const [attendance, setAttendance] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ---- Load data on mount ---- */
  useEffect(() => {
    loadAll();
  }, []);

  /* ---- Reset page when filters change ---- */
  useEffect(() => {
    setPage(1);
  }, [search, filterGroupId, filterCoachId, showArchived, perPage]);

  useEffect(() => {
    if (!isOwner && groups.length === 1 && addGroups.length === 0) {
      setAddGroups([groups[0].id]);
    }
  }, [groups]);

  async function loadAll() {
    setLoading(true);
    setError('');

    if (!isOwner && profile.coach_id) {
      const { data: myCoachGroups } = await supabase
        .from('coach_groups')
        .select('group_id')
        .eq('coach_id', profile.coach_id);

      const myGroupIds = myCoachGroups?.map(r => r.group_id) || [];

      const { data: childLinks } = await supabase
        .from('children_groups')
        .select('child_id')
        .in('group_id', myGroupIds.length > 0 ? myGroupIds : ['00000000-0000-0000-0000-000000000000']);

      const childIds = [...new Set(childLinks?.map(r => r.child_id) || [])];

      const [childrenRes, groupsRes] = await Promise.all([
        childIds.length > 0
          ? supabase
              .from('children')
              .select('id, full_name, date_of_birth, tel, parent_name, parent_phone, fee, arch, created_at, children_groups(group_id, groups(id, name, fee))')
              .in('id', childIds)
              .order('full_name')
          : Promise.resolve({ data: [], error: null }),
        supabase.from('groups').select('id, name, fee').in('id', myGroupIds.length > 0 ? myGroupIds : ['00000000-0000-0000-0000-000000000000']).order('name'),
      ]);

      if (childrenRes.error) setError('Nije moguće učitati djecu.');
      else setChildren(childrenRes.data || []);
      if (!groupsRes.error) setGroups(groupsRes.data || []);
    } else {
      const [childrenRes, groupsRes, coachesRes] = await Promise.all([
        supabase
          .from('children')
          .select('id, full_name, date_of_birth, tel, parent_name, parent_phone, fee, arch, created_at, children_groups(group_id, groups(id, name, fee))')
          .order('full_name'),
        supabase.from('groups').select('id, name, fee, coach_groups(coach_id)').order('name'),
        supabase.from('coaches').select('id, full_name').order('full_name'),
      ]);

      if (childrenRes.error) setError('Nije moguće učitati djecu.');
      else setChildren(childrenRes.data || []);
      if (!groupsRes.error) setGroups(groupsRes.data || []);
      if (!coachesRes.error) setCoaches(coachesRes.data || []);
    }

    setLoading(false);
  }

  async function loadChildDetail(child) {
    setDetailLoading(true);
    const [attRes, memRes] = await Promise.all([
      supabase
        .from('attendance')
        .select('id, date, status, group_id')
        .eq('child_id', child.id)
        .order('date', { ascending: false })
        .limit(15),
      supabase
        .from('memberships')
        .select('id, period, amount, status, payment_date')
        .eq('child_id', child.id)
        .order('period', { ascending: false })
        .limit(12),
    ]);
    setAttendance(attRes.data || []);
    setMemberships(memRes.data || []);
    setDetailLoading(false);
  }

  /* ============================================================
     Add child handler
     ============================================================ */

  async function handleAddChild(e) {
    e.preventDefault();
    setAddError('');

    const ime = addIme.trim();
    const prez = addPrez.trim();

    if (!ime || !prez) {
      setAddError('Ime i prezime su obavezni.');
      return;
    }
    if (addGroups.length === 0) {
      setAddError('Dijete mora biti u bar jednoj grupi.');
      return;
    }

    setAddSaving(true);
    const fullName = `${ime} ${prez}`;

    const { data: newChild, error: insertErr } = await supabase
      .from('children')
      .insert({
        club_id: profile.club_id,
        full_name: fullName,
        date_of_birth: addDob || null,
        tel: addTel.trim() || null,
        parent_name: addRoditelj.trim() || null,
        parent_phone: addRtel.trim() || null,
      })
      .select('id')
      .single();

    if (insertErr) {
      setAddError('Dodavanje nije uspjelo. Pokušajte ponovo.');
      setAddSaving(false);
      return;
    }

    /* Insert group memberships */
    await supabase.from('children_groups').insert(
      addGroups.map((gId) => ({
        club_id: profile.club_id,
        child_id: newChild.id,
        group_id: gId,
      }))
    );

    /* Reset form, keep selected groups, focus Ime for quick entry */
    setAddIme('');
    setAddPrez('');
    setAddDob('');
    setAddTel('');
    setAddRoditelj('');
    setAddRtel('');
    setAddError('');
    setAddSaving(false);

    await loadAll();
    setTimeout(() => addImeRef.current?.focus(), 50);
  }

  /* ============================================================
     Save edit handler
     ============================================================ */

  async function handleSaveEdit(e) {
    e.preventDefault();
    setEditError('');

    const ime = editIme.trim();
    const prez = editPrez.trim();

    if (!ime || !prez) {
      setEditError('Ime i prezime su obavezni.');
      return;
    }
    if (editGroups.length === 0) {
      setEditError('Dijete mora biti u bar jednoj grupi.');
      return;
    }

    setEditSaving(true);

    const { error: updateErr } = await supabase
      .from('children')
      .update({
        full_name: `${ime} ${prez}`,
        date_of_birth: editDob || null,
        tel: editTel.trim() || null,
        parent_name: editRoditelj.trim() || null,
        parent_phone: editRtel.trim() || null,
        fee: isOwner && editFee.trim() ? parseFloat(editFee) : null,
      })
      .eq('id', editingChild.id);

    if (updateErr) {
      setEditError('Čuvanje nije uspjelo. Pokušajte ponovo.');
      setEditSaving(false);
      return;
    }

    if (isOwner) {
      await supabase.from('children_groups').delete().eq('child_id', editingChild.id);
      await supabase.from('children_groups').insert(
        editGroups.map((gId) => ({
          club_id: profile.club_id,
          child_id: editingChild.id,
          group_id: gId,
        }))
      );
    } else {
      const myGroupIds = groups.map(g => g.id);
      if (myGroupIds.length > 0) {
        await supabase.from('children_groups').delete()
          .eq('child_id', editingChild.id)
          .in('group_id', myGroupIds);
      }
      await supabase.from('children_groups').insert(
        editGroups
          .filter(gId => myGroupIds.includes(gId))
          .map((gId) => ({
            club_id: profile.club_id,
            child_id: editingChild.id,
            group_id: gId,
          }))
      );
    }

    await loadAll();
    setEditingChild(null);
    setEditSaving(false);
  }

  /* ============================================================
     Archive / restore / delete
     ============================================================ */

  async function handleArchive(child) {
    if (!window.confirm(`Arhivirati dijete "${child.full_name}"?`)) return;
    await supabase.from('children').update({ arch: true }).eq('id', child.id);
    setSelectedChild(null);
    await loadAll();
  }

  async function handleRestore(child) {
    await supabase.from('children').update({ arch: false }).eq('id', child.id);
    setSelectedChild(null);
    await loadAll();
  }

  async function handleDelete(child) {
    if (
      !window.confirm(
        `Trajno obrisati dijete "${child.full_name}"? Ova radnja se ne može poništiti.`
      )
    )
      return;
    await supabase.from('children').delete().eq('id', child.id);
    setSelectedChild(null);
    await loadAll();
  }

  /* ============================================================
     Open edit form (prefills state from child)
     ============================================================ */

  function openEdit(child) {
    const nameParts = (child.full_name || '').trim().split(' ');
    const prez = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    setEditIme(nameParts[0] || '');
    setEditPrez(prez);
    setEditDob(child.date_of_birth || '');
    setEditTel(child.tel || '');
    setEditRoditelj(child.parent_name || '');
    setEditRtel(child.parent_phone || '');
    setEditGroups(child.children_groups?.map((cg) => cg.group_id) || []);
    setEditFee(child.fee != null ? String(child.fee) : '');
    setEditError('');
    setEditingChild(child);
  }

  /* ============================================================
     Early returns: loading / error
     ============================================================ */

  if (loading) {
    return <p className="text-secondary">Učitavanje djece...</p>;
  }

  if (error) {
    return (
      <div>
        <p className="text-error">{error}</p>
        <button className="btn btn-secondary" onClick={loadAll}>
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  /* ============================================================
     Filtering (computed each render)
     ============================================================ */

  const filtered = children.filter((c) => {
    if (c.arch !== showArchived) return false;
    if (
      filterGroupId &&
      !c.children_groups?.some((cg) => cg.group_id === filterGroupId)
    )
      return false;
    if (filterCoachId) {
      const coachGroupIds = groups
        .filter(g => g.coach_groups?.some(cg => cg.coach_id === filterCoachId))
        .map(g => g.id);
      if (!c.children_groups?.some(cg => coachGroupIds.includes(cg.group_id))) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const fullName = (c.full_name || '').toLowerCase();
      const parent = (c.parent_name || '').toLowerCase();
      if (!fullName.includes(q) && !parent.includes(q)) return false;
    }
    return true;
  });

  const activeCount = children.filter((c) => !c.arch).length;
  const archiveCount = children.filter((c) => c.arch).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageStart = (page - 1) * perPage;
  const pageEnd = Math.min(pageStart + perPage, filtered.length);
  const pageChildren = filtered.slice(pageStart, pageEnd);

  /* ============================================================
     VIEW 1: DETAIL (karton djeteta)
     ============================================================ */

  if (selectedChild && !editingChild) {
    const presentCount = attendance.filter((a) => a.status === 'present').length;
    const totalCount = attendance.length;
    const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

    return (
      <div className="dj-view">
        <button
          className="btn btn-ghost dj-back"
          onClick={() => setSelectedChild(null)}
        >
          ← Nazad na spisak
        </button>

        <div className="card">
          <div className="card__body">
            <div className="dj-detail-header">
              <InitialsCircle name={selectedChild.full_name} size={56} />
              <div>
                <h2 className="dj-detail-name">{selectedChild.full_name}</h2>
                <div className="group-tags">
                  {selectedChild.children_groups?.map((cg) => (
                    <span key={cg.group_id} className="group-tag">
                      {cg.groups?.name}
                    </span>
                  ))}
                  {selectedChild.arch && (
                    <span className="dj-badge-arch">arhivirano</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <div className="dj-info-grid">
              {selectedChild.date_of_birth && (
                <div className="dj-info-row">
                  <span className="dj-info-label">Datum rođenja</span>
                  <span>{formatDateDisplay(selectedChild.date_of_birth)}</span>
                </div>
              )}
              {selectedChild.tel && (
                <div className="dj-info-row">
                  <span className="dj-info-label">Tel. djeteta</span>
                  <a href={`tel:${selectedChild.tel}`} className="dj-tel-link">
                    {selectedChild.tel}
                  </a>
                </div>
              )}
              {selectedChild.parent_name && (
                <div className="dj-info-row">
                  <span className="dj-info-label">Roditelj</span>
                  <span>{selectedChild.parent_name}</span>
                </div>
              )}
              {selectedChild.parent_phone && (
                <div className="dj-info-row">
                  <span className="dj-info-label">Tel. roditelja</span>
                  <a
                    href={`tel:${selectedChild.parent_phone}`}
                    className="dj-tel-link"
                  >
                    {selectedChild.parent_phone}
                  </a>
                </div>
              )}
              <div className="dj-info-row">
                <span className="dj-info-label">Članarina</span>
                <span>
                  {selectedChild.fee != null
                    ? `${selectedChild.fee} € (posebna)`
                    : selectedChild.children_groups?.[0]?.groups?.fee != null
                    ? `${selectedChild.children_groups[0].groups.fee} €`
                    : profile?.clubs?.fee != null
                    ? `${profile.clubs.fee} € (osnovna)`
                    : '—'}
                </span>
              </div>
            </div>

            <div className="dj-actions">
              <button
                className="btn btn-secondary"
                onClick={() => openEdit(selectedChild)}
              >
                Uredi
              </button>
              {!selectedChild.arch ? (
                <button
                  className="btn btn-outline-danger"
                  onClick={() => handleArchive(selectedChild)}
                >
                  Arhiviraj
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleRestore(selectedChild)}
                  >
                    Vrati iz arhive
                  </button>
                  {isOwner && (
                    <button
                      className="btn btn-outline-danger"
                      onClick={() => handleDelete(selectedChild)}
                    >
                      Obriši trajno
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <h3 className="card__title">Prisustvo</h3>
            {detailLoading ? (
              <p className="text-secondary">Učitavanje...</p>
            ) : (
              <>
                <p className="dj-att-summary">
                  Došao {presentCount} od {totalCount} treninga ({pct}%)
                </p>
                <div className="dj-progress-bar">
                  <div
                    className="dj-progress-bar__fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {attendance.length > 0 && (
                  <div className="dj-att-list">
                    {attendance.map((a) => (
                      <span
                        key={a.id}
                        className={`dj-att-dot ${
                          a.status === 'present'
                            ? 'dj-att-dot--yes'
                            : 'dj-att-dot--no'
                        }`}
                        title={formatDateDisplay(a.date)}
                      >
                        {a.status === 'present' ? '✓' : '✗'}
                      </span>
                    ))}
                  </div>
                )}
                {attendance.length === 0 && (
                  <p className="text-secondary">Nema zabilježenih treninga.</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <h3 className="card__title">Članarine — zadnjih 12 mjeseci</h3>
            {detailLoading ? (
              <p className="text-secondary">Učitavanje...</p>
            ) : memberships.length === 0 ? (
              <p className="text-secondary">Nema zabilježenih članarina.</p>
            ) : (
              <ul className="item-list">
                {memberships.map((m, i) => (
                  <li
                    key={m.id}
                    className={`item-list__row ${
                      i < memberships.length - 1
                        ? 'item-list__row--separator'
                        : ''
                    }`}
                  >
                    <span className="item-list__name">
                      {monthLabel(m.period)}
                    </span>
                    {m.status === 'paid' ? (
                      <span className="dj-paid">{m.amount} €</span>
                    ) : (
                      <span className="dj-unpaid">✗</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     VIEW 2: EDIT form
     ============================================================ */

  if (editingChild) {
    return (
      <div className="dj-view">
        <button
          className="btn btn-ghost dj-back"
          onClick={() => setEditingChild(null)}
        >
          ← Nazad
        </button>

        <div className="card">
          <div className="card__body">
            <h2 className="card__title">Uredi dijete</h2>
            <form onSubmit={handleSaveEdit}>
              <div className="dj-form-grid">
                <div className="form-field">
                  <label className="form-label" htmlFor="edit-ime">
                    Ime
                  </label>
                  <input
                    id="edit-ime"
                    className="form-input"
                    type="text"
                    value={editIme}
                    onChange={(e) => setEditIme(e.target.value)}
                    disabled={editSaving}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="edit-prez">
                    Prezime
                  </label>
                  <input
                    id="edit-prez"
                    className="form-input"
                    type="text"
                    value={editPrez}
                    onChange={(e) => setEditPrez(e.target.value)}
                    disabled={editSaving}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="edit-dob">
                    Datum rođenja{' '}
                    <span className="form-label__optional">(opciono)</span>
                  </label>
                  <input
                    id="edit-dob"
                    className="form-input"
                    type="date"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    disabled={editSaving}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="edit-tel">
                    Tel. djeteta{' '}
                    <span className="form-label__optional">(opciono)</span>
                  </label>
                  <input
                    id="edit-tel"
                    className="form-input"
                    type="tel"
                    value={editTel}
                    onChange={(e) => setEditTel(e.target.value)}
                    disabled={editSaving}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="edit-roditelj">
                    Roditelj{' '}
                    <span className="form-label__optional">(opciono)</span>
                  </label>
                  <input
                    id="edit-roditelj"
                    className="form-input"
                    type="text"
                    value={editRoditelj}
                    onChange={(e) => setEditRoditelj(e.target.value)}
                    disabled={editSaving}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="edit-rtel">
                    Tel. roditelja{' '}
                    <span className="form-label__optional">(opciono)</span>
                  </label>
                  <input
                    id="edit-rtel"
                    className="form-input"
                    type="tel"
                    value={editRtel}
                    onChange={(e) => setEditRtel(e.target.value)}
                    disabled={editSaving}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Grupe</label>
                <div className="dj-group-checkboxes">
                  {groups.map((g) => (
                    <label key={g.id} className="dj-group-check">
                      <input
                        type="checkbox"
                        checked={editGroups.includes(g.id)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setEditGroups((prev) => [...prev, g.id]);
                          else
                            setEditGroups((prev) =>
                              prev.filter((id) => id !== g.id)
                            );
                        }}
                        disabled={editSaving}
                      />
                      {g.name}
                    </label>
                  ))}
                  {groups.length === 0 && (
                    <p className="text-secondary">Nema dostupnih grupa.</p>
                  )}
                </div>
              </div>

              {isOwner && (
                <div className="form-field">
                  <label className="form-label" htmlFor="edit-fee">
                    Posebna cijena{' '}
                    <span className="form-label__optional">(€, opciono)</span>
                  </label>
                  <input
                    id="edit-fee"
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editFee}
                    onChange={(e) => setEditFee(e.target.value)}
                    placeholder="Prazno = cijena grupe"
                    disabled={editSaving}
                  />
                </div>
              )}

              {editError && <p className="form-error">{editError}</p>}

              <div className="dj-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingChild(null)}
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editSaving}
                >
                  {editSaving ? 'Čuvanje...' : 'Sačuvaj promjene'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     VIEW 3: LIST (default)
     ============================================================ */

  return (
    <div className="dj-view">
      {/* Search */}
      <div className="dj-search-row">
        <input
          className="form-input"
          type="search"
          placeholder="Pretraga po imenu, roditelju..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Toolbar: Add, Filters, Archive pills */}
      <div className="dj-toolbar">
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm((p) => !p)}
        >
          {showAddForm ? 'Zatvori' : 'Dodaj dijete'}
        </button>
        <button
          className={`btn btn-secondary ${
            showFilters ? 'dj-filter-btn--active' : ''
          }`}
          onClick={() => setShowFilters((p) => !p)}
        >
          Filteri
        </button>
        <div className="dj-arch-pills">
          <button
            className={`dj-arch-pill ${
              !showArchived ? 'dj-arch-pill--active' : ''
            }`}
            onClick={() => setShowArchived(false)}
          >
            Aktivna ({activeCount})
          </button>
          <button
            className={`dj-arch-pill ${
              showArchived ? 'dj-arch-pill--active' : ''
            }`}
            onClick={() => setShowArchived(true)}
          >
            Arhiva ({archiveCount})
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card">
          <div className="card__body">
            <div className="form-field">
              <label className="form-label">Grupa</label>
              <select
                className="form-select dj-filter-select"
                value={filterGroupId}
                onChange={(e) => setFilterGroupId(e.target.value)}
              >
                <option value="">Sve grupe</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            {isOwner && coaches.length > 0 && (
              <div className="form-field">
                <label className="form-label">Trener</label>
                <select
                  className="form-select dj-filter-select"
                  value={filterCoachId}
                  onChange={(e) => setFilterCoachId(e.target.value)}
                >
                  <option value="">Svi treneri</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="card">
          <div className="card__body">
            <h3 className="card__title">Novo dijete</h3>
            <form onSubmit={handleAddChild}>
              <div className="dj-form-grid">
                <div className="form-field">
                  <label className="form-label" htmlFor="add-ime">
                    Ime
                  </label>
                  <input
                    id="add-ime"
                    ref={addImeRef}
                    className="form-input"
                    type="text"
                    value={addIme}
                    onChange={(e) => setAddIme(e.target.value)}
                    placeholder="npr. Marko"
                    disabled={addSaving}
                    autoFocus
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="add-prez">
                    Prezime
                  </label>
                  <input
                    id="add-prez"
                    className="form-input"
                    type="text"
                    value={addPrez}
                    onChange={(e) => setAddPrez(e.target.value)}
                    placeholder="npr. Marković"
                    disabled={addSaving}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="add-dob">
                    Datum rođenja{' '}
                    <span className="form-label__optional">(opciono)</span>
                  </label>
                  <input
                    id="add-dob"
                    className="form-input"
                    type="date"
                    value={addDob}
                    onChange={(e) => setAddDob(e.target.value)}
                    disabled={addSaving}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="add-tel">
                    Tel. djeteta{' '}
                    <span className="form-label__optional">(opciono)</span>
                  </label>
                  <input
                    id="add-tel"
                    className="form-input"
                    type="tel"
                    value={addTel}
                    onChange={(e) => setAddTel(e.target.value)}
                    disabled={addSaving}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="add-roditelj">
                    Roditelj{' '}
                    <span className="form-label__optional">(opciono)</span>
                  </label>
                  <input
                    id="add-roditelj"
                    className="form-input"
                    type="text"
                    value={addRoditelj}
                    onChange={(e) => setAddRoditelj(e.target.value)}
                    disabled={addSaving}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="add-rtel">
                    Tel. roditelja{' '}
                    <span className="form-label__optional">(opciono)</span>
                  </label>
                  <input
                    id="add-rtel"
                    className="form-input"
                    type="tel"
                    value={addRtel}
                    onChange={(e) => setAddRtel(e.target.value)}
                    disabled={addSaving}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Grupe</label>
                <div className="dj-group-checkboxes">
                  {groups.map((g) => (
                    <label key={g.id} className="dj-group-check">
                      <input
                        type="checkbox"
                        checked={addGroups.includes(g.id)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setAddGroups((prev) => [...prev, g.id]);
                          else
                            setAddGroups((prev) =>
                              prev.filter((id) => id !== g.id)
                            );
                        }}
                        disabled={addSaving}
                      />
                      {g.name}
                    </label>
                  ))}
                  {groups.length === 0 && (
                    <p className="text-secondary">Nema dostupnih grupa.</p>
                  )}
                </div>
              </div>

              {addError && <p className="form-error">{addError}</p>}

              <div className="dj-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddForm(false)}
                >
                  Zatvori
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addSaving}
                >
                  {addSaving ? 'Dodavanje...' : 'Dodaj dijete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">
              {showArchived
                ? 'Arhiva je prazna.'
                : search
                ? 'Nema rezultata pretrage.'
                : 'Nema evidentiranih članova.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="item-list">
              {pageChildren.map((child, i) => (
                <li
                  key={child.id}
                  className={`item-list__row item-list__row--clickable ${
                    i < pageChildren.length - 1
                      ? 'item-list__row--separator'
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedChild(child);
                    loadChildDetail(child);
                  }}
                >
                  <div className="dj-list-row-inner">
                    <InitialsCircle name={child.full_name} size={40} />
                    <div className="item-list__info">
                      <span className="item-list__name">{child.full_name}</span>
                      <div className="group-tags">
                        {child.children_groups?.map((cg) => (
                          <span key={cg.group_id} className="group-tag">
                            {cg.groups?.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="dj-arrow">›</span>
                </li>
              ))}
            </ul>

            <div className="dj-pagination">
              <div className="dj-pagination__info">
                Prikazano{' '}
                {filtered.length === 0 ? 0 : pageStart + 1}–{pageEnd} od{' '}
                {filtered.length}
              </div>
              <div className="dj-pagination__controls">
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  ← Prethodna
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === totalPages}
                >
                  Sljedeća →
                </button>
              </div>
              <div className="dj-pagination__perpage">
                <label className="form-label">Po stranici:</label>
                <select
                  className="form-select"
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DjecaView;
