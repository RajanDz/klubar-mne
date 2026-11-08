import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './CoachesPage.css';

const PER_PAGE = 10;

function CoachesPage() {
  const { profile } = useAuth();

  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadCoaches();
  }, []);

  async function loadCoaches() {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('coaches')
      .select('id, full_name, phone, email, created_at, coach_groups(group_id, groups(id, name))')
      .order('full_name', { ascending: true });

    if (fetchError) {
      setError('Nije moguće učitati trenere. Pokušajte ponovo.');
    } else {
      setCoaches(data);
      setCurrentPage(p => Math.min(p, Math.max(1, Math.ceil(data.length / PER_PAGE))));
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

    const { error: insertError } = await supabase
      .from('coaches')
      .insert({
        club_id: profile.club_id,
        full_name: name,
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
      });

    if (insertError) {
      setFormError('Dodavanje trenera nije uspjelo. Pokušajte ponovo.');
    } else {
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setShowForm(false);
      setCurrentPage(1);
      await loadCoaches();
    }

    setSaving(false);
  }

  async function handleDeleteCoach(coachId, coachName) {
    const confirmed = window.confirm(
      `Da li ste sigurni da želite obrisati trenera "${coachName}"?`
    );
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('coaches')
      .delete()
      .eq('id', coachId);

    if (deleteError) {
      alert('Brisanje nije uspjelo. Pokušajte ponovo.');
      return;
    }

    await loadCoaches();
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

  const totalPages = Math.max(1, Math.ceil(coaches.length / PER_PAGE));
  const pageCoaches = coaches.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  return (
    <div className="coaches-page">

      <div className="page-header">
        <div>
          <h2 className="page-header__title">Treneri</h2>
          <p className="page-header__description">
            Stručni kadar i dodjele grupama
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm((prev) => !prev);
            setFormError('');
          }}
        >
          {showForm ? 'Odustani' : 'Novi trener'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card__body">
            <h3 className="card__title">Novi trener</h3>
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
                {saving ? 'Dodavanje...' : 'Dodaj trenera'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        {coaches.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">Nema trenera</p>
            <p className="empty-state__description">
              Klub još nema nijednog trenera.
            </p>
          </div>
        ) : (
          <>
            <ul className="item-list">
                  {pageCoaches.map((coach, index) => (
                    <li
                      key={coach.id}
                      className={`item-list__row ${index < pageCoaches.length - 1 ? 'item-list__row--separator' : ''}`}
                    >
                      <div className="item-list__info">
                        <span className="item-list__name">{coach.full_name}</span>
                        {coach.phone && (
                          <span className="item-list__description">{coach.phone}</span>
                        )}
                        {coach.coach_groups?.length > 0 && (
                          <div className="group-tags">
                            {coach.coach_groups.map((cg) => (
                              <span key={cg.group_id} className="group-tag">
                                {cg.groups?.name}
                              </span>
                            ))}
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

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setCurrentPage(p => p - 1)}
                      disabled={currentPage === 1}
                    >
                      ← Prethodna
                    </button>
                    <span className="pagination__info">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Sljedeća →
                    </button>
                  </div>
                )}
          </>
        )}
      </div>

    </div>
  );
}

export default CoachesPage;
