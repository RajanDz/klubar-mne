import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './GrupePage.css';

function GrupePage() {
  const { profile } = useAuth();

  const [groups, setGroups] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Prati koji group_id se trenutno ažurira (za disabled stanje dropdowna)
  const [assigningGroupId, setAssigningGroupId] = useState(null);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');

    // Učitavamo grupe i trenere istovremeno
    const [groupsResult, coachesResult] = await Promise.all([
      supabase
        .from('groups')
        .select(`
          id,
          name,
          description,
          created_at,
          children_groups ( child_id ),
          coach_groups ( coach_id, coaches ( id, full_name ) )
        `)
        .order('created_at', { ascending: true }),

      supabase
        .from('coaches')
        .select('id, full_name')
        .order('full_name', { ascending: true }),
    ]);

    if (groupsResult.error) {
      setError('Nije moguće učitati grupe. Pokušajte ponovo.');
    } else {
      setGroups(groupsResult.data);
    }

    if (!coachesResult.error) {
      setCoaches(coachesResult.data);
    }

    setLoading(false);
  }

  async function handleAssignCoach(groupId, coachId) {
    setAssigningGroupId(groupId);

    // Ukloniti postojeću dodjelu za ovu grupu
    await supabase
      .from('coach_groups')
      .delete()
      .eq('group_id', groupId);

    // Ako je odabran trener (nije "bez trenera"), upisati novu dodjelu
    if (coachId) {
      await supabase.from('coach_groups').insert({
        club_id: profile.club_id,
        coach_id: coachId,
        group_id: groupId,
      });
    }

    await loadData();
    setAssigningGroupId(null);
  }

  async function handleAddGroup(e) {
    e.preventDefault();
    setFormError('');

    const name = newName.trim();
    if (!name) {
      setFormError('Naziv grupe je obavezan.');
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase
      .from('groups')
      .insert({
        club_id: profile.club_id,
        name,
        description: newDescription.trim() || null,
      });

    if (insertError) {
      setFormError('Kreiranje grupe nije uspjelo. Pokušajte ponovo.');
    } else {
      setNewName('');
      setNewDescription('');
      await loadData();
    }

    setSaving(false);
  }

  async function handleDeleteGroup(groupId, groupName) {
    const confirmed = window.confirm(
      `Da li ste sigurni da želite obrisati grupu "${groupName}"?`
    );
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (deleteError) {
      if (deleteError.code === '23503') {
        alert('Nije moguće obrisati grupu koja ima evidenciju dolazaka.');
      } else {
        alert('Brisanje nije uspjelo. Pokušajte ponovo.');
      }
      return;
    }

    await loadData();
  }

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

  return (
    <div className="groups-page">

      <div className="card">
        {groups.length === 0 ? (
          <p className="empty-state">Klub još nema nijednu grupu.</p>
        ) : (
          <ul className="item-list">
            {groups.map((group, index) => {
              // Svaka grupa ima najviše jednog trenera u UI-u (index 0)
              const currentCoachId = group.coach_groups?.[0]?.coach_id ?? '';
              const isAssigning = assigningGroupId === group.id;

              return (
                <li
                  key={group.id}
                  className={`item-list__row ${index < groups.length - 1 ? 'item-list__row--separator' : ''}`}
                >
                  <div className="item-list__info">
                    <span className="item-list__name">{group.name}</span>
                    <span className="item-list__meta">
                      {group.children_groups.length} djece
                    </span>
                    {group.description && (
                      <span className="item-list__description">{group.description}</span>
                    )}
                  </div>

                  <div className="group-row__actions">
                    <select
                      className="form-select"
                      value={currentCoachId}
                      onChange={(e) => handleAssignCoach(group.id, e.target.value)}
                      disabled={isAssigning}
                    >
                      <option value="">— bez trenera —</option>
                      {coaches.map((coach) => (
                        <option key={coach.id} value={coach.id}>
                          {coach.full_name}
                        </option>
                      ))}
                    </select>

                    <button
                      className="btn btn-outline-danger"
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      disabled={isAssigning}
                    >
                      Obriši
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="card__title">Nova grupa</h2>
        <form onSubmit={handleAddGroup}>
          <div className="form-field">
            <label className="form-label" htmlFor="group-name">
              Naziv grupe
            </label>
            <input
              id="group-name"
              className="form-input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="npr. Kadeti 2011"
              disabled={saving}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="group-description">
              Opis <span className="form-label__optional">(opciono)</span>
            </label>
            <input
              id="group-description"
              className="form-input"
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="npr. Uzrast 2011. godišta"
              disabled={saving}
            />
          </div>

          {formError && <p className="form-error">{formError}</p>}

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Dodavanje...' : 'Dodaj grupu'}
          </button>
        </form>
      </div>

    </div>
  );
}

export default GrupePage;
