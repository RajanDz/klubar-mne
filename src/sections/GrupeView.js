import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './GrupeView.css';

/* ============================================================
   Day names (indices 1..7 = Mon..Sun)
   ============================================================ */

const DAY_NAMES = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

/* ============================================================
   GrupeView — list groups, inline edit (fee/coach/schedule),
   add new group
   ============================================================ */

function GrupeView() {
  const { profile } = useAuth();
  const isOwner = profile?.roles?.value === 'owner';

  const [groups, setGroups] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Which group has schedule panel open, coach picker open, and which is saving */
  const [openScheduleId, setOpenScheduleId] = useState(null);
  const [openCoachPickerId, setOpenCoachPickerId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (!openCoachPickerId) return;
    function onMouseDown(e) {
      if (!e.target.closest('.grupe-coach-picker')) setOpenCoachPickerId(null);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [openCoachPickerId]);

  /* Add group form */
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');

    const [gRes, cRes] = await Promise.all([
      supabase
        .from('groups')
        .select(
          'id, name, description, fee, days, time, created_at, children_groups(child_id), coach_groups(coach_id, coaches(id, full_name))'
        )
        .order('name'),
      supabase.from('coaches').select('id, full_name, users!users_coach_id_fkey(id)').order('full_name'),
    ]);

    if (gRes.error) {
      setError('Nije moguće učitati grupe.');
    } else if (isOwner) {
      setGroups(gRes.data || []);
    } else {
      const myGroups = gRes.data?.filter(g =>
        g.coach_groups?.some(cg => cg.coach_id === profile.coach_id)
      ) || [];
      setGroups(myGroups);
    }

    if (!cRes.error) setCoaches((cRes.data || []).filter(c => c.users?.length > 0));

    setLoading(false);
  }

  /* ---- Build the short description line under group name ---- */
  function scheduleLabel(group) {
    const parts = [];
    const childCount = group.children_groups?.length ?? 0;
    parts.push(`${childCount} djece`);
    if (group.fee != null) parts.push(`${group.fee} €`);
    if (group.days?.length > 0) {
      const sorted = [...group.days].sort((a, b) => a - b);
      const dayStr = sorted.map((d) => DAY_NAMES[d - 1]).join(', ');
      parts.push(group.time ? `${dayStr} u ${group.time}` : dayStr);
    } else {
      parts.push('bez rasporeda');
    }
    const coachNames = group.coach_groups?.map(cg => cg.coaches?.full_name).filter(Boolean);
    if (coachNames?.length > 0) parts.push(`treneri: ${coachNames.join(', ')}`);
    else parts.push('bez trenera');
    return parts.join(' · ');
  }

  /* ============================================================
     Inline update handlers
     ============================================================ */

  async function handleFeeChange(groupId, value) {
    setSavingId(groupId);
    const fee = value.trim() ? parseFloat(value) : null;
    await supabase.from('groups').update({ fee }).eq('id', groupId);
    await loadData();
    setSavingId(null);
  }

  async function handleCoachToggle(groupId, coachId, isAssigned) {
    setSavingId(groupId);
    if (isAssigned) {
      await supabase.from('coach_groups').delete()
        .eq('group_id', groupId).eq('coach_id', coachId);
    } else {
      await supabase.from('coach_groups').insert({
        club_id: profile.club_id,
        coach_id: coachId,
        group_id: groupId,
      });
    }
    await loadData();
    setSavingId(null);
  }

  async function handleDayToggle(group, day) {
    const current = group.days || [];
    const newDays = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    setSavingId(group.id);
    await supabase.from('groups').update({ days: newDays }).eq('id', group.id);
    await loadData();
    setSavingId(null);
  }

  async function handleTimeChange(groupId, time) {
    setSavingId(groupId);
    await supabase.from('groups').update({ time: time || null }).eq('id', groupId);
    await loadData();
    setSavingId(null);
  }

  /* ============================================================
     Delete group
     ============================================================ */

  async function handleDeleteGroup(groupId, groupName) {
    if (!window.confirm(`Obrisati grupu "${groupName}"?`)) return;

    const { error: deleteErr } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (deleteErr) {
      if (deleteErr.code === '23503') {
        alert('Nije moguće obrisati grupu koja ima evidenciju dolazaka.');
      } else {
        alert('Brisanje nije uspjelo.');
      }
      return;
    }
    await loadData();
  }

  /* ============================================================
     Add group
     ============================================================ */

  async function handleAddGroup(e) {
    e.preventDefault();
    setAddError('');

    const name = newName.trim();
    if (!name) {
      setAddError('Naziv grupe je obavezan.');
      return;
    }

    setAddSaving(true);

    const { error: insertErr } = await supabase.from('groups').insert({
      club_id: profile.club_id,
      name,
      description: newDesc.trim() || null,
    });

    if (insertErr) {
      setAddError('Kreiranje grupe nije uspjelo.');
      setAddSaving(false);
      return;
    }

    setNewName('');
    setNewDesc('');
    setAddError('');
    setShowAddForm(false);
    await loadData();
    setAddSaving(false);
  }

  /* ============================================================
     Loading / error states
     ============================================================ */

  if (loading) {
    return <p className="text-secondary">Učitavanje grupa...</p>;
  }

  if (error) {
    return (
      <div>
        <p className="text-error">{error}</p>
        <button className="btn btn-secondary" onClick={loadData}>
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  /* ============================================================
     Render
     ============================================================ */

  return (
    <div className="grupe-view">
      {isOwner && (
        <div className="card">
          <div className="grupe-add-header">
            <button
              className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => {
                setShowAddForm(!showAddForm);
                setAddError('');
              }}
            >
              {showAddForm ? '✕ Odustani' : '+ Dodaj grupu'}
            </button>
          </div>

          {showAddForm && (
            <div className="card__body grupe-add-form">
              <form onSubmit={handleAddGroup}>
                <div className="form-field">
                  <label className="form-label" htmlFor="grupe-name">
                    Naziv grupe
                  </label>
                  <input
                    id="grupe-name"
                    className="form-input"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="npr. Kadeti 2012"
                    disabled={addSaving}
                    autoFocus
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="grupe-desc">
                    Opis <span className="form-label__optional">(opciono)</span>
                  </label>
                  <input
                    id="grupe-desc"
                    className="form-input"
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="npr. Uzrast 2012. godišta"
                    disabled={addSaving}
                  />
                </div>

                {addError && <p className="form-error">{addError}</p>}

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={addSaving}
                >
                  {addSaving ? 'Dodavanje...' : 'Sačuvaj grupu'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p className="empty-state__title">Nema grupa.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <ul className="item-list">
            {groups.map((group, i) => {
              const isOpen = openScheduleId === group.id;
              const isPickerOpen = openCoachPickerId === group.id;
              const isSaving = savingId === group.id;
              const assignedCount = group.coach_groups?.length ?? 0;

              return (
                <li
                  key={group.id}
                  className={`grupe-row ${
                    i < groups.length - 1 ? 'item-list__row--separator' : ''
                  }`}
                >
                  <div className="grupe-row__main">
                    <div className="item-list__info">
                      <span className="item-list__name">{group.name}</span>
                      <span className="item-list__description">
                        {scheduleLabel(group)}
                      </span>
                    </div>

                    {isOwner && (
                      <div className="grupe-row__actions">
                        <div className="grupe-row__fee-wrap">
                          <input
                            className="form-input grupe-fee-input"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={group.fee ?? ''}
                            placeholder="Cijena €"
                            onBlur={(e) =>
                              handleFeeChange(group.id, e.target.value)
                            }
                            disabled={isSaving}
                          />
                        </div>
                        <div className="grupe-coach-picker">
                          <button
                            className={`btn btn-secondary grupe-coach-picker__trigger ${isPickerOpen ? 'grupe-coach-picker__trigger--open' : ''}`}
                            onClick={() => setOpenCoachPickerId(isPickerOpen ? null : group.id)}
                            disabled={isSaving}
                          >
                            Treneri{assignedCount > 0 ? ` (${assignedCount})` : ''}
                          </button>
                          {isPickerOpen && (
                            <div className="grupe-coach-picker__panel">
                              {coaches.map((coach) => {
                                const isAssigned = group.coach_groups?.some(cg => cg.coach_id === coach.id);
                                return (
                                  <label key={coach.id} className="grupe-coach-picker__row">
                                    <input
                                      type="checkbox"
                                      checked={isAssigned}
                                      onChange={() => handleCoachToggle(group.id, coach.id, isAssigned)}
                                      disabled={isSaving}
                                    />
                                    {coach.full_name}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button
                          className="btn btn-secondary"
                          onClick={() =>
                            setOpenScheduleId(isOpen ? null : group.id)
                          }
                        >
                          Raspored
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() =>
                            handleDeleteGroup(group.id, group.name)
                          }
                          disabled={isSaving}
                        >
                          Obriši
                        </button>
                      </div>
                    )}
                  </div>

                  {isOwner && isOpen && (
                    <div className="grupe-schedule-panel">
                      <div className="grupe-day-pills">
                        {DAY_NAMES.map((label, idx) => {
                          const day = idx + 1;
                          const active = group.days?.includes(day);
                          return (
                            <button
                              key={day}
                              className={`grupe-day-pill ${
                                active ? 'grupe-day-pill--active' : ''
                              }`}
                              onClick={() => handleDayToggle(group, day)}
                              disabled={isSaving}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        className="form-input grupe-time-input"
                        type="time"
                        defaultValue={group.time || ''}
                        onBlur={(e) =>
                          handleTimeChange(group.id, e.target.value)
                        }
                        disabled={isSaving}
                        placeholder="HH:MM"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

    </div>
  );
}

export default GrupeView;
