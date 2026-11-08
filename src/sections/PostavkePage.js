import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { applyThemeVars, DEFAULT_THEME, DARK_BG_DEFAULT, LIGHT_BG_DEFAULT } from '../lib/theme';
import './PostavkePage.css';

/* ============================================================
   Konstante
   ============================================================ */

const SPORTS = [
  'Fudbal', 'Košarka', 'Odbojka', 'Rukomet', 'Tenis', 'Stoni tenis',
  'Plivanje', 'Atletika', 'Boks', 'Džudo', 'Karate', 'Gimnastika',
  'Rvanje', 'Biciklizam', 'Streljaštvo', 'Borilačke vještine', 'Ostalo',
];

const PRIMARY_PRESETS = [
  '#c94a18', '#2563eb', '#16a34a', '#7c3aed',
  '#db2777', '#0891b2', '#d97706',
];

const BG_PRESETS_LIGHT = [
  '#f4f3ef', '#f8fafc', '#f0fdf4', '#eff6ff', '#fdf4ff', '#fff7ed',
];

const BG_PRESETS_DARK = [
  '#0f172a', '#1e293b', '#1a1a2e', '#0d1b2a', '#1a0a2e', '#12120e',
];

/* ============================================================
   Pomoćne funkcije
   ============================================================ */

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   ResetBtn — ikonica za reset pojedinog parametra
   ============================================================ */

function ResetBtn({ onClick, title = 'Vrati na početnu' }) {
  return (
    <button className="set-reset-btn" onClick={onClick} title={title}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
    </button>
  );
}

/* ============================================================
   ColorRow — red paleta boja + inline color picker
   ============================================================ */

function ColorRow({ colors, selected, onSelect }) {
  const pickerRef = useRef(null);
  const isCustom  = selected && !colors.includes(selected);

  return (
    <div className="set-color-row">
      {colors.map(c => (
        <button
          key={c}
          className={`set-swatch ${selected === c ? 'set-swatch--active' : ''}`}
          style={{ background: c }}
          onClick={() => onSelect(c)}
          title={c}
        />
      ))}

      {/* Zadnji krug = inline color picker */}
      <button
        className={`set-swatch set-swatch--picker ${isCustom ? 'set-swatch--active' : ''}`}
        style={isCustom ? { background: selected } : {}}
        onClick={() => pickerRef.current?.click()}
        title="Prilagođena boja"
      >
        {!isCustom && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
          </svg>
        )}
        <input
          ref={pickerRef}
          type="color"
          value={isCustom ? selected : '#c94a18'}
          onChange={e => onSelect(e.target.value)}
          className="set-hidden-picker"
        />
      </button>
    </div>
  );
}

/* ============================================================
   SegmentedControl — generički
   ============================================================ */

function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="set-seg" role="group">
      {options.map(o => (
        <button
          key={o.val}
          className={`set-seg-btn ${value === o.val ? 'set-seg-btn--active' : ''}`}
          onClick={() => onChange(o.val)}
        >
          {o.icon && <span className="set-seg-icon">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   PostavkePage
   ============================================================ */

function PostavkePage() {
  const { profile, refreshProfile } = useAuth();
  const club = profile?.clubs ?? {};

  /* ---- Podaci o klubu ---- */
  const [clubName,  setClubName]  = useState(club.name  ?? '');
  const [sport,     setSport]     = useState(club.sport  ?? '');
  const [logoPreview, setLogoPreview] = useState(club.logo_url ?? null);
  const [logoFile,    setLogoFile]    = useState(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const [savingClub,  setSavingClub]  = useState(false);
  const [clubMsg,     setClubMsg]     = useState('');
  const fileInputRef = useRef(null);

  /* ---- Tema ---- */
  const saved = club.theme ?? {};
  const [mode,     setMode]     = useState(saved.mode     ?? DEFAULT_THEME.mode);
  const [primary,  setPrimary]  = useState(saved.primary  ?? DEFAULT_THEME.primary);
  const [bg,       setBg]       = useState(saved.bg       ?? DEFAULT_THEME.bg);
  const [textMode, setTextMode] = useState(saved.textMode ?? DEFAULT_THEME.textMode);
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeMsg,    setThemeMsg]    = useState('');

  /* Live preview: primijeni CSS varijable odmah na svaku promjenu */
  useEffect(() => {
    applyThemeVars({ mode, primary, bg, textMode });
  }, [mode, primary, bg, textMode]);

  /* Promjena moda — auto-switch bg na odgovarajući preset ako je trenutni preset pogrešnog moda */
  function handleModeChange(newMode) {
    setMode(newMode);
    const wrongPresets = newMode === 'dark' ? BG_PRESETS_LIGHT : BG_PRESETS_DARK;
    const rightDefault = newMode === 'dark' ? DARK_BG_DEFAULT : LIGHT_BG_DEFAULT;
    if (wrongPresets.includes(bg)) setBg(rightDefault);
  }

  /* ---- Čuvanje podataka o klubu ---- */
  async function handleSaveClub() {
    if (!clubName.trim()) return;
    setSavingClub(true);
    setClubMsg('');

    let logoUrl = club.logo_url ?? null;
    if (logoFile) {
      try {
        logoUrl = await fileToBase64(logoFile);
      } catch {
        setClubMsg('Greška pri učitavanju slike.');
        setSavingClub(false);
        return;
      }
    } else if (logoPreview === null) {
      logoUrl = null;
    }

    const { error } = await supabase.from('clubs')
      .update({ name: clubName.trim(), sport: sport || null, logo_url: logoUrl })
      .eq('id', club.id);

    if (error) {
      setClubMsg('Greška pri čuvanju. Pokušaj ponovo.');
    } else {
      setClubMsg('Sačuvano!');
      setLogoFile(null);
      await refreshProfile();
      setTimeout(() => setClubMsg(''), 2500);
    }
    setSavingClub(false);
  }

  /* ---- Drag & drop logo ---- */
  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() { setIsDragging(false); }

  async function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      setLogoFile(file);
      setLogoPreview(await fileToBase64(file));
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(await fileToBase64(file));
    }
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  /* ---- Čuvanje teme ---- */
  async function handleSaveTheme() {
    setSavingTheme(true);
    setThemeMsg('');

    const theme = { mode, primary, bg, textMode };
    const { error } = await supabase.from('clubs')
      .update({ theme })
      .eq('id', club.id);

    if (error) {
      setThemeMsg('Greška pri čuvanju teme.');
    } else {
      setThemeMsg('Tema sačuvana!');
      await refreshProfile();
      setTimeout(() => setThemeMsg(''), 2500);
    }
    setSavingTheme(false);
  }

  /* ---- Resetovanje teme ---- */
  async function handleResetTheme() {
    if (!window.confirm('Resetovati izgled aplikacije na početne vrijednosti?')) return;
    setMode(DEFAULT_THEME.mode);
    setPrimary(DEFAULT_THEME.primary);
    setBg(DEFAULT_THEME.bg);
    setTextMode(DEFAULT_THEME.textMode);
    await supabase.from('clubs').update({ theme: null }).eq('id', club.id);
    await refreshProfile();
  }

  /* ---- Render ---- */
  return (
    <div className="set-page">

      <div className="set-grid">

        {/* ========== Lijeva kolona ========== */}
        <div className="set-col">

          {/* Podaci o klubu */}
          <div className="card card__body set-card">
            <h2 className="set-card-title">Podaci o klubu</h2>

            <div className="set-field">
              <label className="form-label" htmlFor="club-name">Naziv kluba</label>
              <input
                id="club-name"
                className="form-input"
                type="text"
                value={clubName}
                onChange={e => setClubName(e.target.value)}
                placeholder="Unesite naziv kluba"
              />
            </div>

            <div className="set-field">
              <label className="form-label" htmlFor="club-sport">Sport</label>
              <select
                id="club-sport"
                className="form-select"
                value={sport}
                onChange={e => setSport(e.target.value)}
              >
                <option value="">— Odaberi sport —</option>
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="set-footer">
              {clubMsg && (
                <span className={`set-msg ${clubMsg.includes('Greška') ? 'set-msg--error' : 'set-msg--ok'}`}>
                  {clubMsg}
                </span>
              )}
              <button
                className="btn btn-primary"
                onClick={handleSaveClub}
                disabled={savingClub || !clubName.trim()}
              >
                {savingClub ? 'Čuvanje...' : 'Sačuvaj podatke'}
              </button>
            </div>
          </div>

          {/* Grb kluba */}
          <div className="card card__body set-card">
            <h2 className="set-card-title">Grb kluba</h2>

            {logoPreview ? (
              <div className="set-logo-preview">
                <img src={logoPreview} alt="Grb kluba" className="set-logo-img" />
                <button className="btn btn-secondary set-logo-remove" onClick={handleRemoveLogo}>
                  Ukloni sliku
                </button>
              </div>
            ) : (
              <div
                className={`set-dropzone ${isDragging ? 'set-dropzone--over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <svg className="set-dropzone__icon" width="36" height="36" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className="set-dropzone__text">Klikni ili prevuci sliku ovdje</p>
                <p className="set-dropzone__hint">Preporučeno: PNG, maksimum 2 MB</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

        </div>

        {/* ========== Desna kolona ========== */}
        <div className="set-col">

          {/* Izgled aplikacije */}
          <div className="card card__body set-card">
            <h2 className="set-card-title">Izgled aplikacije</h2>

            {/* Mod prikaza */}
            <div className="set-theme-block">
              <div className="set-theme-label-row">
                <span className="set-theme-label">Mod prikaza</span>
              </div>
              <SegmentedControl
                value={mode}
                onChange={handleModeChange}
                options={[
                  {
                    val: 'light',
                    label: 'Svijetlo',
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>
                    ),
                  },
                  {
                    val: 'dark',
                    label: 'Tamno',
                    icon: (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>
                    ),
                  },
                ]}
              />
            </div>

            <div className="set-sep" />

            {/* Glavna boja */}
            <div className="set-theme-block">
              <div className="set-theme-label-row">
                <span className="set-theme-label">Glavna boja</span>
                <ResetBtn onClick={() => setPrimary(DEFAULT_THEME.primary)} />
              </div>
              <ColorRow
                colors={PRIMARY_PRESETS}
                selected={primary}
                onSelect={setPrimary}
              />
            </div>

            <div className="set-sep" />

            {/* Boja pozadine */}
            <div className="set-theme-block">
              <div className="set-theme-label-row">
                <span className="set-theme-label">Boja pozadine</span>
                <ResetBtn onClick={() => setBg(DEFAULT_THEME.bg)} />
              </div>
              <ColorRow
                colors={mode === 'dark' ? BG_PRESETS_DARK : BG_PRESETS_LIGHT}
                selected={bg}
                onSelect={setBg}
              />
            </div>

            <div className="set-sep" />

            {/* Boja slova */}
            <div className="set-theme-block">
              <div className="set-theme-label-row">
                <span className="set-theme-label">Boja slova</span>
              </div>
              <SegmentedControl
                value={textMode}
                onChange={setTextMode}
                options={[
                  { val: 'auto',  label: 'Auto' },
                  { val: 'dark',  label: 'Tamna' },
                  { val: 'light', label: 'Svijetla' },
                ]}
              />
            </div>

            {/* Preview traka */}
            <div className="set-preview-bar">
              <div className="set-preview-chip" style={{ background: primary }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Aa</span>
              </div>
              <div className="set-preview-chip set-preview-chip--bg">
                <span style={{ fontSize: 12, fontWeight: 600 }}>Aa</span>
              </div>
              <span className="set-preview-label">Ovako će izgledati tema</span>
            </div>

            <div className="set-footer">
              {themeMsg && (
                <span className={`set-msg ${themeMsg.includes('Greška') ? 'set-msg--error' : 'set-msg--ok'}`}>
                  {themeMsg}
                </span>
              )}
              <button
                className="btn btn-primary"
                onClick={handleSaveTheme}
                disabled={savingTheme}
              >
                {savingTheme ? 'Čuvanje...' : 'Primijeni temu'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Globalni reset */}
      <div className="set-global-reset">
        <button className="btn btn-outline-danger" onClick={handleResetTheme}>
          Počni ispočetka
        </button>
        <span className="set-global-reset__hint">
          Resetuje temu na početne boje aplikacije.
        </span>
      </div>

    </div>
  );
}

export default PostavkePage;
