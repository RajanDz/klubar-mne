import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import './DjecaPage.css';

function formatDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}.`;
}

function DjecaPage() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedChild, setSelectedChild] = useState(null);

  useEffect(() => {
    loadChildren();
  }, []);

  async function loadChildren() {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('children')
      .select(`
        id, full_name, date_of_birth, parent_name, parent_phone, created_at,
        children_groups ( group_id, groups ( id, name ) )
      `)
      .order('full_name', { ascending: true });

    if (fetchError) {
      setError('Nije moguće učitati djecu. Pokušajte ponovo.');
    } else {
      setChildren(data);
    }

    setLoading(false);
  }

  if (loading) {
    return <p className="text-secondary">Učitavanje djece...</p>;
  }

  if (error) {
    return (
      <div>
        <p className="text-error">{error}</p>
        <button className="btn btn-secondary" onClick={loadChildren}>
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  if (selectedChild) {
    return (
      <div className="djeca-page">
        <div className="page-header">
          <div>
            <button
              className="btn btn-ghost djeca-back-btn"
              onClick={() => setSelectedChild(null)}
            >
              ← Nazad
            </button>
            <h2 className="page-header__title">{selectedChild.full_name}</h2>
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <div className="detail-grid">
              {selectedChild.children_groups?.length > 0 && (
                <div className="detail-field">
                  <span className="detail-label">Grupe</span>
                  <div className="group-tags">
                    {selectedChild.children_groups.map(cg => (
                      <span key={cg.group_id} className="group-tag">
                        {cg.groups?.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedChild.date_of_birth && (
                <div className="detail-field">
                  <span className="detail-label">Datum rođenja</span>
                  <span className="detail-value">{formatDate(selectedChild.date_of_birth)}</span>
                </div>
              )}

              {selectedChild.parent_name && (
                <div className="detail-field">
                  <span className="detail-label">Roditelj / staratelj</span>
                  <span className="detail-value">{selectedChild.parent_name}</span>
                </div>
              )}

              {selectedChild.parent_phone && (
                <div className="detail-field">
                  <span className="detail-label">Kontakt roditelja</span>
                  <span className="detail-value">{selectedChild.parent_phone}</span>
                </div>
              )}

              {!selectedChild.date_of_birth &&
                !selectedChild.parent_name &&
                !selectedChild.parent_phone &&
                selectedChild.children_groups?.length === 0 && (
                  <p className="text-muted">Nema dodatnih podataka za ovog člana.</p>
                )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const searchTerm = search.toLowerCase().trim();
  const filtered = searchTerm
    ? children.filter(c =>
        c.full_name?.toLowerCase().includes(searchTerm) ||
        c.parent_name?.toLowerCase().includes(searchTerm) ||
        c.parent_phone?.toLowerCase().includes(searchTerm)
      )
    : children;

  return (
    <div className="djeca-page">
      <div className="page-header">
        <div>
          <h2 className="page-header__title">Djeca</h2>
          <p className="page-header__description">Svi članovi kluba</p>
        </div>
      </div>

      <div className="card">
        <div className="djeca-search">
          <input
            className="form-input"
            type="text"
            placeholder="Pretraga po imenu djeteta ili roditelja..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            {searchTerm ? (
              <>
                <p className="empty-state__title">Nema rezultata</p>
                <p className="empty-state__description">
                  Pokušajte s drugačijim pojmom pretrage.
                </p>
              </>
            ) : (
              <>
                <p className="empty-state__title">Nema djece</p>
                <p className="empty-state__description">
                  Klub još nema evidentiranih članova.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="item-list">
            {filtered.map((child, index) => (
              <li
                key={child.id}
                className={`item-list__row item-list__row--clickable ${index < filtered.length - 1 ? 'item-list__row--separator' : ''}`}
                onClick={() => setSelectedChild(child)}
              >
                <div className="item-list__info">
                  <span className="item-list__name">{child.full_name}</span>
                  {child.parent_name && (
                    <span className="item-list__meta">{child.parent_name}</span>
                  )}
                  {child.children_groups?.length > 0 && (
                    <div className="group-tags">
                      {child.children_groups.map(cg => (
                        <span key={cg.group_id} className="group-tag">
                          {cg.groups?.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="djeca-arrow">›</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DjecaPage;
