import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './GrupePage.css';

function GrupePage() {
  const { profile } = useAuth();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('groups')
      .select('id, name, description, created_at, children_groups(child_id)')
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError('Nije moguće učitati grupe. Pokušajte ponovo.');
    } else {
      setGroups(data);
    }

    setLoading(false);
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
      await loadGroups();
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

    await loadGroups();
  }

  if (loading) {
    return <p className="text-secondary">Učitavanje grupa...</p>;
  }

  if (error) {
    return (
      <div>
        <p className="text-error">{error}</p>
        <button className="btn btn-secondary" onClick={loadGroups}>
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
            {groups.map((group, index) => (
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
                <button
                  className="btn btn-outline-danger"
                  onClick={() => handleDeleteGroup(group.id, group.name)}
                >
                  Obriši
                </button>
              </li>
            ))}
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
