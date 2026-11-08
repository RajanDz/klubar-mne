import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './TreneriView.css';

function TreneriView() {
  const { profile } = useAuth();

  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [generatingFor, setGeneratingFor] = useState(null);
  const [codes, setCodes] = useState({});
  const [copyMsg, setCopyMsg] = useState({});

  useEffect(() => {
    loadCoaches();
  }, []);

  async function loadCoaches() {
    setLoading(true);
    setError('');

    const { data, error: fetchErr } = await supabase
      .from('coaches')
      .select('id, full_name, phone, email, coach_groups(group_id, groups(id, name)), users!users_coach_id_fkey(id)')
      .order('full_name');

    if (fetchErr) {
      setError('Nije moguće učitati trenere.');
    } else {
      setCoaches(data || []);
    }
    setLoading(false);
  }

  async function handleAddCoach(e) {
    e.preventDefault();
    setFormError('');

    const name = newName.trim();
    if (!name) {
      setFormError('Ime i prezime trenera je obavezno.');
      return;
    }

    setSaving(true);

    const { error: insertErr } = await supabase.from('coaches').insert({
      club_id: profile.club_id,
      full_name: name,
      phone: newPhone.trim() || null,
      email: newEmail.trim() || null,
    });

    if (insertErr) {
      setFormError('Dodavanje trenera nije uspjelo. Pokušajte ponovo.');
      setSaving(false);
      return;
    }

    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setShowAddForm(false);
    await loadCoaches();
    setSaving(false);
  }

  async function handleDeleteCoach(coachId, coachName) {
    if (!window.confirm(`Obrisati trenera "${coachName}"?`)) return;

    const { error: deleteErr } = await supabase
      .from('coaches')
      .delete()
      .eq('id', coachId);

    if (deleteErr) {
      alert('Brisanje nije uspjelo. Pokušajte ponovo.');
      return;
    }
    await loadCoaches();
  }

  async function handleGenerateCode(coachId) {
    setGeneratingFor(coachId);

    const { data, error: genErr } = await supabase.rpc('generate_invite', {
      p_coach_id: coachId,
    });

    if (!genErr) {
      setCodes((prev) => ({ ...prev, [coachId]: data }));
    }

    setGeneratingFor(null);
  }

  function handleCopy(coachId, code) {
    navigator.clipboard.writeText(code);
    setCopyMsg((prev) => ({ ...prev, [coachId]: true }));
    setTimeout(() => {
      setCopyMsg((prev) => ({ ...prev, [coachId]: false }));
    }, 2000);
  }

  if (loading) {
    return <p className="text-secondary">Učitavanje trenera...</p>;
  }

  if (error) {
    return (
      <div>
        <p className="text-error">{error}</p>
        <button className="btn btn-secondary" onClick={loadCoaches}>
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  return (
    <div className="treneri-view">
      <div className="card">
        <div className="treneri-add-header">
          <button
            className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => {
              setShowAddForm(!showAddForm);
              setFormError('');
            }}
          >
            {showAddForm ? '✕ Odustani' : '+ Dodaj trenera'}
          </button>
        </div>

        {showAddForm && (
          <div className="card__body treneri-add-form">
            <form onSubmit={handleAddCoach}>
              <div className="form-field">
                <label className="form-label" htmlFor="coach-name">
                  Ime i prezime
                </label>
                <input
                  id="coach-name"
                  className="form-input"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="npr. Marko Marković"
                  disabled={saving}
                  autoFocus
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="coach-phone">
                  Telefon <span className="form-label__optional">(opciono)</span>
                </label>
                <input
                  id="coach-phone"
                  className="form-input"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="npr. 067 123 456"
                  disabled={saving}
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="coach-email">
                  Email <span className="form-label__optional">(opciono)</span>
                </label>
                <input
                  id="coach-email"
                  className="form-input"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="npr. marko@email.com"
                  disabled={saving}
                />
              </div>

              {formError && <p className="form-error">{formError}</p>}

              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Dodavanje...' : 'Sačuvaj trenera'}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="card">
        {coaches.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">Nema trenera.</p>
            <p className="empty-state__description">
              Klub još nema nijednog trenera.
            </p>
          </div>
        ) : (
          <ul className="item-list">
            {coaches.map((coach, i) => (
              <li
                key={coach.id}
                className={`item-list__row ${
                  i < coaches.length - 1 ? 'item-list__row--separator' : ''
                }`}
              >
                <div className="item-list__info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="item-list__name">{coach.full_name}</span>
                    {coach.users?.length > 0 ? (
                      <span className="coach-badge coach-badge--active">Aktivan nalog</span>
                    ) : null}
                  </div>

                  {coach.coach_groups?.length > 0 ? (
                    <div className="group-tags">
                      {coach.coach_groups.map((cg) => (
                        <span key={cg.group_id} className="group-tag">
                          {cg.groups?.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="item-list__description">bez grupa</span>
                  )}

                  {coach.users?.length === 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '13px', padding: '4px 12px' }}
                        onClick={() => handleGenerateCode(coach.id)}
                        disabled={generatingFor === coach.id}
                      >
                        {generatingFor === coach.id ? 'Generisanje...' : 'Generiši kod'}
                      </button>

                      {codes[coach.id] && (
                        <div className="invite-code-box">
                          <div>
                            <div className="invite-code-box__code">{codes[coach.id]}</div>
                            <div className="invite-code-box__meta">Važi 48 sati</div>
                          </div>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '13px', padding: '4px 12px' }}
                            onClick={() => handleCopy(coach.id, codes[coach.id])}
                          >
                            {copyMsg[coach.id] ? '✓ Kopirano' : 'Kopiraj'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-outline-danger"
                  onClick={() => handleDeleteCoach(coach.id, coach.full_name)}
                >
                  Obriši
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TreneriView;
