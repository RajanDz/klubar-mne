import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './GrupePage.css';

function GrupePage() {
  const { profile } = useAuth();

  // Lista grupa — svaka grupa sadrži i children_groups array za brojanje djece
  const [grupe, setGrupe] = useState([]);
  const [ucitavanje, setUcitavanje] = useState(true);
  const [greska, setGreska] = useState('');

  // Stanje forme za kreiranje nove grupe
  const [noviNaziv, setNoviNaziv] = useState('');
  const [noviOpis, setNoviOpis] = useState('');
  const [cuvanje, setCuvanje] = useState(false);
  const [greskaForme, setGreskaForme] = useState('');

  useEffect(() => {
    ucitajGrupe();
  }, []);

  async function ucitajGrupe() {
    setUcitavanje(true);
    setGreska('');

    // Učitavamo grupe zajedno sa children_groups zapisima da bismo mogli
    // izbrojati koliko djece pripada svakoj grupi
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, description, created_at, children_groups(child_id)')
      .order('created_at', { ascending: true });

    if (error) {
      setGreska('Nije moguće učitati grupe. Pokušajte ponovo.');
    } else {
      setGrupe(data);
    }

    setUcitavanje(false);
  }

  async function handleDodajGrupu(e) {
    e.preventDefault();
    setGreskaForme('');

    const naziv = noviNaziv.trim();
    if (!naziv) {
      setGreskaForme('Naziv grupe je obavezan.');
      return;
    }

    setCuvanje(true);

    const { error } = await supabase
      .from('groups')
      .insert({
        club_id: profile.club_id,
        name: naziv,
        description: noviOpis.trim() || null,
      });

    if (error) {
      setGreskaForme('Kreiranje grupe nije uspjelo. Pokušajte ponovo.');
    } else {
      setNoviNaziv('');
      setNoviOpis('');
      await ucitajGrupe();
    }

    setCuvanje(false);
  }

  async function handleObrisiGrupu(grupaId, nazivGrupe) {
    const potvrda = window.confirm(
      `Da li ste sigurni da želite obrisati grupu "${nazivGrupe}"?`
    );
    if (!potvrda) return;

    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', grupaId);

    if (error) {
      // Brisanje može biti blokiran ako grupa ima evidenciju dolazaka
      if (error.code === '23503') {
        alert('Nije moguće obrisati grupu koja ima evidenciju dolazaka.');
      } else {
        alert('Brisanje nije uspjelo. Pokušajte ponovo.');
      }
      return;
    }

    await ucitajGrupe();
  }

  // ---- Stanja prikaza ----

  if (ucitavanje) {
    return <p className="status-tekst">Učitavanje grupa...</p>;
  }

  if (greska) {
    return (
      <div>
        <p className="status-tekst status-tekst--greska">{greska}</p>
        <button className="btn btn-secondary" onClick={ucitajGrupe}>
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  return (
    <div className="grupe-stranica">

      {/* Lista postojećih grupa */}
      <div className="kartica">
        {grupe.length === 0 ? (
          <p className="prazno-stanje">Klub još nema nijednu grupu.</p>
        ) : (
          <ul className="grupe-lista">
            {grupe.map((grupa, index) => (
              <li
                key={grupa.id}
                className={`grupe-stavka ${index < grupe.length - 1 ? 'grupe-stavka--separator' : ''}`}
              >
                <div className="grupe-stavka__info">
                  <span className="grupe-stavka__naziv">{grupa.name}</span>
                  <span className="grupe-stavka__djeca">
                    {grupa.children_groups.length} djece
                  </span>
                  {grupa.description && (
                    <span className="grupe-stavka__opis">{grupa.description}</span>
                  )}
                </div>
                <button
                  className="btn btn-danger-outline"
                  onClick={() => handleObrisiGrupu(grupa.id, grupa.name)}
                >
                  Obriši
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Forma za kreiranje nove grupe */}
      <div className="kartica">
        <h2 className="kartica__naslov">Nova grupa</h2>
        <form onSubmit={handleDodajGrupu}>
          <div className="form-field">
            <label className="form-label" htmlFor="naziv-grupe">
              Naziv grupe
            </label>
            <input
              id="naziv-grupe"
              className="form-input"
              type="text"
              value={noviNaziv}
              onChange={(e) => setNoviNaziv(e.target.value)}
              placeholder="npr. Kadeti 2011"
              disabled={cuvanje}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="opis-grupe">
              Opis <span className="form-label__opciono">(opciono)</span>
            </label>
            <input
              id="opis-grupe"
              className="form-input"
              type="text"
              value={noviOpis}
              onChange={(e) => setNoviOpis(e.target.value)}
              placeholder="npr. Uzrast 2011. godišta"
              disabled={cuvanje}
            />
          </div>

          {greskaForme && (
            <p className="form-error">{greskaForme}</p>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={cuvanje}
          >
            {cuvanje ? 'Dodavanje...' : 'Dodaj grupu'}
          </button>
        </form>
      </div>

    </div>
  );
}

export default GrupePage;
