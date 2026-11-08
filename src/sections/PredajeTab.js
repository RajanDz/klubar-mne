import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/* ============================================================
   Helpers
   ============================================================ */

function fmt(n) {
  const v = parseFloat(n) || 0;
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const s = new Date(ym + '-01T00:00:00')
    .toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function requestedYM(isoTs) {
  const d = new Date(isoTs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ============================================================
   TrenerPredaje — prikaz za trenera
   ============================================================ */

function TrenerPredaje() {
  const { profile } = useAuth();

  const [kodMene,    setKodMene]    = useState([]);   // plaćene uplate bez predaje
  const [handovers,  setHandovers]  = useState([]);   // sve moje predaje
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [withdrawing, setWithdrawing] = useState(null);

  const [histMonth,  setHistMonth]  = useState(currentYM());
  const [showAllMonths, setShowAllMonths] = useState(true);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  async function loadAll() {
    setLoading(true);

    const [kodRes, handRes] = await Promise.all([
      supabase.from('memberships')
        .select('id, amount, child_id, group_id, period, payment_date, children(full_name), groups(name)')
        .eq('coach_id', profile.coach_id)
        .is('handover_id', null)
        .eq('status', 'paid'),
      supabase.from('handovers')
        .select('id, amount, status, requested_at, confirmed_at')
        .eq('coach_id', profile.coach_id)
        .order('requested_at', { ascending: false }),
    ]);

    setKodMene(kodRes.data || []);
    setHandovers(handRes.data || []);
    setLoading(false);
  }

  async function handleSubmit() {
    if (kodMeneAmount <= 0) return;
    setSubmitError('');
    setSubmitting(true);

    const { data: handover, error: hErr } = await supabase.from('handovers').insert({
      club_id:  profile.club_id,
      coach_id: profile.coach_id,
      amount:   kodMeneAmount,
    }).select('id').single();

    if (hErr) {
      setSubmitError('Slanje zahtjeva nije uspjelo. Pokušajte ponovo.');
      setSubmitting(false);
      return;
    }

    await supabase.from('memberships')
      .update({ handover_id: handover.id })
      .eq('coach_id', profile.coach_id)
      .is('handover_id', null)
      .eq('status', 'paid');

    await loadAll();
    setSubmitting(false);
  }

  async function handleWithdraw(handoverId) {
    setWithdrawing(handoverId);

    await supabase.from('memberships')
      .update({ handover_id: null })
      .eq('handover_id', handoverId);

    await supabase.from('handovers').delete().eq('id', handoverId);

    await loadAll();
    setWithdrawing(null);
  }

  const kodMeneAmount = kodMene.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);

  const pending   = handovers.filter(h => h.status === 'pending');
  const confirmed = handovers.filter(h => h.status === 'confirmed');

  const histFiltered = showAllMonths
    ? handovers
    : handovers.filter(h => requestedYM(h.requested_at) === histMonth);

  const confirmedInMonth = histFiltered
    .filter(h => h.status === 'confirmed')
    .reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);

  if (loading) return <p className="text-secondary">Učitavanje...</p>;

  return (
    <div className="pre-tab">

      {/* ---- Kutija "Kod mene" ---- */}
      <div className="pre-box">
        <div className="pre-box__top">
          <span className="pre-box__label">Kod mene</span>
          <span className="pre-box__amount">{fmt(kodMeneAmount)} €</span>
        </div>
        <p className="pre-box__desc">
          Novac koji si primio od roditelja, a još ga nisi predao vlasniku.
        </p>

        {kodMeneAmount > 0 && (
          <>
            {submitError && <p className="form-error">{submitError}</p>}
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Slanje...' : 'Predao sam novac vlasniku'}
            </button>
          </>
        )}
      </div>

      {/* ---- Pending predaje ---- */}
      {pending.map(h => (
        <div key={h.id} className="pre-handover-card">
          <div className="pre-handover-card__row">
            <div>
              <span className="pre-handover-card__date">{formatDate(h.requested_at)}</span>
              <span className="pre-badge pre-badge--pending">čeka potvrdu</span>
            </div>
            <span className="pre-handover-card__amount">{fmt(h.amount)} €</span>
          </div>
          <button
            className="btn btn-secondary pre-withdraw-btn"
            onClick={() => handleWithdraw(h.id)}
            disabled={withdrawing === h.id}
          >
            {withdrawing === h.id ? 'Povlačenje...' : 'Povuci'}
          </button>
        </div>
      ))}

      {/* ---- Istorija predaja ---- */}
      {handovers.length > 0 && (
        <>
          <div className="pre-hist-controls">
            <input
              className="form-input pre-hist-month"
              type="month"
              value={histMonth}
              onChange={e => { setHistMonth(e.target.value); setShowAllMonths(false); }}
            />
            <button
              className={`btn btn-secondary ${showAllMonths ? 'pre-hist-all--active' : ''}`}
              onClick={() => setShowAllMonths(true)}
            >
              Svi mjeseci
            </button>
          </div>

          {!showAllMonths && confirmedInMonth > 0 && (
            <p className="pre-hist-stat">
              Potvrđeno u {monthLabel(histMonth).toLowerCase()}: {fmt(confirmedInMonth)} €
            </p>
          )}

          <div className="pre-hist-title">Moje predaje</div>

          {histFiltered.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <p className="empty-state__title">Nema predaja za odabrani period.</p>
              </div>
            </div>
          ) : (
            <div className="pre-hist-list">
              {histFiltered.map(h => (
                <div key={h.id} className="pre-handover-card">
                  <div className="pre-handover-card__row">
                    <div>
                      <span className="pre-handover-card__date">{formatDate(h.requested_at)}</span>
                      <span className={`pre-badge ${h.status === 'confirmed' ? 'pre-badge--confirmed' : 'pre-badge--pending'}`}>
                        {h.status === 'confirmed' ? '✓ potvrđeno' : 'čeka potvrdu'}
                      </span>
                    </div>
                    <span className="pre-handover-card__amount">{fmt(h.amount)} €</span>
                  </div>
                  {h.status === 'pending' && (
                    <button
                      className="btn btn-secondary pre-withdraw-btn"
                      onClick={() => handleWithdraw(h.id)}
                      disabled={withdrawing === h.id}
                    >
                      {withdrawing === h.id ? 'Povlačenje...' : 'Povuci'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {handovers.length === 0 && kodMeneAmount === 0 && confirmed.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <p className="empty-state__title">Još nema evidencije predaja.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   VlasnikPredaje — prikaz za vlasnika
   ============================================================ */

function VlasnikPredaje() {
  const { profile } = useAuth();

  const [handovers,   setHandovers]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [confirming,  setConfirming]  = useState(null);
  const [cancelling,  setCancelling]  = useState(null);

  const [histMonth,     setHistMonth]     = useState(currentYM());
  const [showAllMonths, setShowAllMonths] = useState(true);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  async function loadAll() {
    setLoading(true);

    const { data } = await supabase.from('handovers')
      .select('id, amount, status, requested_at, confirmed_at, coaches(id, full_name)')
      .eq('club_id', profile.club_id)
      .order('requested_at', { ascending: false });

    setHandovers(data || []);
    setLoading(false);
  }

  async function handleConfirm(handoverId) {
    setConfirming(handoverId);

    await supabase.from('handovers').update({
      status:       'confirmed',
      confirmed_at: new Date().toISOString(),
    }).eq('id', handoverId);

    setHandovers(prev => prev.map(h =>
      h.id === handoverId
        ? { ...h, status: 'confirmed', confirmed_at: new Date().toISOString() }
        : h
    ));
    setConfirming(null);
  }

  async function handleCancel(handoverId) {
    if (!window.confirm('Poništiti ovu predaju? Uplate će biti oslobođene.')) return;
    setCancelling(handoverId);
    await supabase.from('handovers').delete().eq('id', handoverId);
    setHandovers(prev => prev.filter(h => h.id !== handoverId));
    setCancelling(null);
  }

  const pending = handovers.filter(h => h.status === 'pending');

  const histFiltered = showAllMonths
    ? handovers
    : handovers.filter(h => requestedYM(h.requested_at) === histMonth);

  const confirmedInMonth = histFiltered
    .filter(h => h.status === 'confirmed')
    .reduce((s, h) => s + (parseFloat(h.amount) || 0), 0);

  if (loading) return <p className="text-secondary">Učitavanje...</p>;

  return (
    <div className="pre-tab">

      {/* ---- Zahtjevi koji čekaju potvrdu ---- */}
      {pending.length > 0 && (
        <>
          <div className="pre-hist-title">Čeka potvrdu</div>
          {pending.map(h => (
            <div key={h.id} className="pre-handover-card pre-handover-card--pending">
              <div className="pre-handover-card__row">
                <div>
                  <span className="pre-handover-card__coach">{h.coaches?.full_name}</span>
                  <span className="pre-handover-card__date">{formatDate(h.requested_at)}</span>
                </div>
                <span className="pre-handover-card__amount">{fmt(h.amount)} €</span>
              </div>
              <button
                className="btn btn-primary pre-confirm-btn"
                onClick={() => handleConfirm(h.id)}
                disabled={confirming === h.id}
              >
                {confirming === h.id ? 'Potvrđivanje...' : 'Potvrdi prijem'}
              </button>
            </div>
          ))}
        </>
      )}

      {/* ---- Istorija ---- */}
      <div className="pre-hist-controls">
        <input
          className="form-input pre-hist-month"
          type="month"
          value={histMonth}
          onChange={e => { setHistMonth(e.target.value); setShowAllMonths(false); }}
        />
        <button
          className={`btn btn-secondary ${showAllMonths ? 'pre-hist-all--active' : ''}`}
          onClick={() => setShowAllMonths(true)}
        >
          Svi mjeseci
        </button>
      </div>

      {!showAllMonths && confirmedInMonth > 0 && (
        <p className="pre-hist-stat">
          Potvrđeno u {monthLabel(histMonth).toLowerCase()}: {fmt(confirmedInMonth)} €
        </p>
      )}

      <div className="pre-hist-title">Sve predaje</div>

      {histFiltered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p className="empty-state__title">
              {handovers.length === 0
                ? 'Nema evidentiranih predaja.'
                : 'Nema predaja za odabrani period.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="pre-hist-list">
          {histFiltered.map(h => (
            <div key={h.id} className="pre-handover-card">
              <div className="pre-handover-card__row">
                <div>
                  <span className="pre-handover-card__coach">{h.coaches?.full_name}</span>
                  <span className="pre-handover-card__date">{formatDate(h.requested_at)}</span>
                  <span className={`pre-badge ${h.status === 'confirmed' ? 'pre-badge--confirmed' : 'pre-badge--pending'}`}>
                    {h.status === 'confirmed' ? '✓ potvrđeno' : 'čeka potvrdu'}
                  </span>
                </div>
                <span className="pre-handover-card__amount">{fmt(h.amount)} €</span>
              </div>
              {h.status === 'pending' && (
                <button
                  className="btn btn-primary pre-confirm-btn"
                  onClick={() => handleConfirm(h.id)}
                  disabled={confirming === h.id}
                >
                  {confirming === h.id ? 'Potvrđivanje...' : 'Potvrdi prijem'}
                </button>
              )}
              {h.status === 'confirmed' && (
                <button
                  className="btn btn-secondary pre-withdraw-btn"
                  onClick={() => handleCancel(h.id)}
                  disabled={cancelling === h.id}
                >
                  {cancelling === h.id ? 'Poništavanje...' : 'Poništi predaju'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PredajeTab — ulazna tačka, bira prikaz po ulozi
   ============================================================ */

function PredajeTab() {
  const { profile } = useAuth();
  const isTrener = profile?.roles?.value === 'trener';
  return isTrener ? <TrenerPredaje /> : <VlasnikPredaje />;
}

export default PredajeTab;
