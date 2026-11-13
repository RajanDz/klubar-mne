import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import './OverviewPage.css';

/* ============================================================
   Helpers
   ============================================================ */

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonthPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function dateDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(n) {
  const v = parseFloat(n) || 0;
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2);
}

function formatTodayFull() {
  return new Date().toLocaleDateString('sr-Latn', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}


function currentMonthLabel() {
  const s = new Date().toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function computeInactiveChildren(attData, coachGroupMap) {
  const grouped = {};
  for (const row of attData) {
    if (row.children?.arch) continue;
    const key = `${row.child_id}|${row.group_id}`;
    if (!grouped[key]) grouped[key] = {
      childName: row.children?.full_name ?? '',
      groupId:   row.group_id,
      groupName: row.groups?.name ?? '',
      records:   [],
    };
    grouped[key].records.push(row);
  }

  const result = [];
  for (const { childName, groupId, groupName, records } of Object.values(grouped)) {
    let count = 0;
    let lastPresent = null;
    for (const r of records) {
      if (r.status !== 'present') count++;
      else { lastPresent = r.date; break; }
    }
    if (count >= 5) {
      result.push({
        childName,
        groupName,
        coachName: coachGroupMap[groupId] ?? '—',
        count,
        lastPresent,
      });
    }
  }
  return result.sort((a, b) => b.count - a.count);
}

/* ============================================================
   StatCard
   ============================================================ */

function StatCard({ label, value, icon, variant, onClick, loading }) {
  return (
    <div
      className={`ov-stat-card ov-stat-card--${variant} ${onClick ? 'ov-stat-card--clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="ov-stat-card__top">
        <span className="ov-stat-card__value">{loading ? '—' : value}</span>
        <span className="ov-stat-card__icon">{icon}</span>
      </div>
      <span className="ov-stat-card__label">{label}</span>
      {onClick && <span className="ov-stat-card__hint">Klikni za detalje →</span>}
    </div>
  );
}

/* ============================================================
   Icons
   ============================================================ */

function IconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}

function IconCreditCard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function IconBanknote() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>
    </svg>
  );
}

function IconDumbbell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6.5 17.5h11M5.5 9.5v5M18.5 9.5v5M2.5 7.5v9M21.5 7.5v9"/>
    </svg>
  );
}

/* ============================================================
   OverviewPage
   ============================================================ */

function OverviewPage({ onNavigate }) {
  const { profile } = useAuth();
  const isTrener = profile?.roles?.value === 'trener';

  const [loading,     setLoading]     = useState(true);

  const [todayTrainings, setTodayTrainings] = useState([]);
  const [activeCount,    setActiveCount]    = useState(0);
  const [unpaidCount,    setUnpaidCount]    = useState(0);
  const [paidCount,      setPaidCount]      = useState(0);
  const [coachMoney,     setCoachMoney]     = useState(0);
  const [inactiveList,   setInactiveList]   = useState([]);
  const [groups,         setGroups]         = useState([]);
  const [groupMemberMap, setGroupMemberMap] = useState({});

  useEffect(() => { loadDashboard(); }, []); // eslint-disable-line

  async function loadDashboard() {
    setLoading(true);

    const today      = todayISO();
    const period     = currentMonthPeriod();
    const inactive60 = dateDaysAgo(60);

    if (isTrener) {
      await loadTrenerDashboard(today, inactive60);
    } else {
      await loadOwnerDashboard(today, period, inactive60);
    }

    setLoading(false);
  }

  async function loadTrenerDashboard(today, inactive60) {
    const coachId = profile?.coach_id;

    const { data: coachGroupRows } = await supabase
      .from('coach_groups')
      .select('group_id, groups(id, name, days, time)')
      .eq('coach_id', coachId);

    const myGroupIds = (coachGroupRows || []).map(cg => cg.group_id);
    const myGroups   = (coachGroupRows || []).map(cg => cg.groups).filter(Boolean);
    setGroups(myGroups);

    if (myGroupIds.length === 0) return;

    // Convert JS getDay() (0=Sun) to our system (1=Mon...7=Sun)
    const jsDay = new Date().getDay();
    const todayDay = jsDay === 0 ? 7 : jsDay;

    const [todayAttRes, cgRes, inactiveAttRes, coachMoneyRes] = await Promise.all([
      supabase.from('attendance')
        .select('child_id, group_id, status')
        .eq('date', today)
        .in('group_id', myGroupIds),

      supabase.from('children_groups')
        .select('group_id, child_id, children(id, arch)')
        .in('group_id', myGroupIds),

      supabase.from('attendance')
        .select('child_id, group_id, date, status, children(id, full_name, arch), groups(id, name)')
        .gte('date', inactive60)
        .in('group_id', myGroupIds)
        .order('date', { ascending: false }),

      supabase.from('memberships')
        .select('amount')
        .eq('coach_id', coachId)
        .is('handover_id', null)
        .eq('status', 'paid'),
    ]);

    // Active children per group
    const gMap = {};
    for (const row of cgRes.data || []) {
      if (row.children?.arch) continue;
      gMap[row.group_id] = (gMap[row.group_id] || 0) + 1;
    }
    setGroupMemberMap(gMap);

    // Attendance already marked today
    const attMap = {};
    for (const row of todayAttRes.data || []) {
      if (!attMap[row.group_id]) attMap[row.group_id] = { present: 0, total: 0 };
      attMap[row.group_id].total++;
      if (row.status === 'present') attMap[row.group_id].present++;
    }

    // Show groups whose schedule includes today, regardless of attendance
    const todayList = myGroups
      .filter(g => g.days?.includes(todayDay))
      .map(g => ({
        groupId:   g.id,
        groupName: g.name,
        time:      g.time ?? null,
        coachName: profile?.full_name ?? null,
        present:   attMap[g.id]?.present ?? 0,
        total:     gMap[g.id] ?? 0,
      }));
    setTodayTrainings(todayList);

    const coachMap = {};
    for (const cg of coachGroupRows || []) coachMap[cg.group_id] = profile?.full_name ?? '—';
    setInactiveList(computeInactiveChildren(inactiveAttRes.data || [], coachMap));

    const money = (coachMoneyRes.data || []).reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
    setCoachMoney(money);
  }

  async function loadOwnerDashboard(today, period, inactive60) {
    const [
      todayAttRes,
      allChildrenRes,
      paidMemsRes,
      coachMoneyRes,
      groupsRes,
      cgRes,
      coachGroupsRes,
      inactiveAttRes,
    ] = await Promise.all([
      supabase.from('attendance')
        .select('child_id, group_id, status')
        .eq('date', today),

      supabase.from('children')
        .select('id, arch'),

      supabase.from('memberships')
        .select('child_id')
        .eq('period', period)
        .eq('status', 'paid'),

      supabase.from('memberships')
        .select('amount')
        .is('handover_id', null)
        .eq('status', 'paid')
        .not('coach_id', 'is', null),

      supabase.from('groups')
        .select('id, name, days, time')
        .order('name'),

      supabase.from('children_groups')
        .select('group_id, child_id, children(id, arch)'),

      supabase.from('coach_groups')
        .select('group_id, coaches(full_name)'),

      supabase.from('attendance')
        .select('child_id, group_id, date, status, children(id, full_name, arch), groups(id, name)')
        .gte('date', inactive60)
        .order('date', { ascending: false }),
    ]);

    // Convert JS getDay() (0=Sun) to our system (1=Mon...7=Sun)
    const jsDay = new Date().getDay();
    const todayDay = jsDay === 0 ? 7 : jsDay;

    const activeChildren = (allChildrenRes.data || []).filter(c => !c.arch);
    const paidSet = new Set((paidMemsRes.data || []).map(m => m.child_id));
    setActiveCount(activeChildren.length);
    setPaidCount(paidSet.size);
    setUnpaidCount(Math.max(0, activeChildren.length - paidSet.size));

    const money = (coachMoneyRes.data || []).reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
    setCoachMoney(money);

    setGroups(groupsRes.data || []);

    // Active children per group
    const gMap = {};
    for (const row of cgRes.data || []) {
      if (row.children?.arch) continue;
      gMap[row.group_id] = (gMap[row.group_id] || 0) + 1;
    }
    setGroupMemberMap(gMap);

    // Coach per group
    const coachMap = {};
    for (const row of coachGroupsRes.data || []) {
      coachMap[row.group_id] = row.coaches?.full_name ?? null;
    }

    // Attendance already marked today
    const attMap = {};
    for (const row of todayAttRes.data || []) {
      if (!attMap[row.group_id]) attMap[row.group_id] = { present: 0, total: 0 };
      attMap[row.group_id].total++;
      if (row.status === 'present') attMap[row.group_id].present++;
    }

    // Show groups whose schedule includes today, regardless of attendance
    const todayList = (groupsRes.data || [])
      .filter(g => g.days?.includes(todayDay))
      .map(g => ({
        groupId:   g.id,
        groupName: g.name,
        time:      g.time ?? null,
        coachName: coachMap[g.id] ?? null,
        present:   attMap[g.id]?.present ?? 0,
        total:     gMap[g.id] ?? 0,
      }));
    setTodayTrainings(todayList);

    setInactiveList(computeInactiveChildren(inactiveAttRes.data || [], coachMap));
  }

  const pieData = [
    { name: 'Platili',      value: paidCount  },
    { name: 'Nisu platili', value: unpaidCount },
  ];
  const PIE_COLORS = ['#2563eb', '#f59e0b'];

  /* ---- Render ---- */
  return (
    <div className="ov-page">

      {/* ---- Header ---- */}
      <div className="ov-header">
        <span className="ov-header__club">{profile?.clubs?.name ?? 'Klub'}</span>
        <span className="ov-header__date">{formatTodayFull()}</span>
      </div>

      {/* ---- Danas ---- */}
      <section className="ov-section">
        <h2 className="ov-section-title">
          <IconDumbbell />
          Danas
        </h2>

        {loading ? (
          <div className="ov-skeleton" style={{ height: 70 }} />
        ) : todayTrainings.length === 0 ? (
          <div className="ov-danas-empty" onClick={() => onNavigate?.('treninzi')}>
            <p>Nema evidentiranih treninga za danas.</p>
            <span className="ov-danas-empty__link">Idi na treninge →</span>
          </div>
        ) : (
          <div className="ov-danas-list">
            {todayTrainings.map(t => (
              <div
                key={t.groupId}
                className="ov-danas-card ov-danas-card--clickable"
                onClick={() => onNavigate?.('treninzi')}
              >
                <div className="ov-danas-card__dot" />
                <div className="ov-danas-card__body">
                  <span className="ov-danas-card__group">{t.groupName}</span>
                  <span className="ov-danas-card__coach">
                    {[t.time, t.coachName].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="ov-danas-card__chip">{t.present}/{t.total}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Stat cards ---- */}
      {isTrener ? (
        <div className="ov-stats-grid">
          <StatCard
            label="Moje grupe"
            value={groups.length}
            icon={<IconUsers />}
            variant="blue"
            loading={loading}
          />
          <StatCard
            label="Neaktivna djeca"
            value={inactiveList.length}
            icon={<IconAlert />}
            variant={inactiveList.length > 0 ? 'orange' : 'blue'}
            loading={loading}
            onClick={() => onNavigate?.('treninzi')}
          />
          <StatCard
            label="Novac kod mene"
            value={`${fmt(coachMoney)} €`}
            icon={<IconBanknote />}
            variant={coachMoney > 0 ? 'orange' : 'blue'}
            loading={loading}
            onClick={() => onNavigate?.('memberships')}
          />
        </div>
      ) : (
        <div className="ov-stats-grid">
          <StatCard
            label="Aktivni članovi"
            value={activeCount}
            icon={<IconUsers />}
            variant="blue"
            loading={loading}
            onClick={() => onNavigate?.('people')}
          />
          <StatCard
            label="Neplaćene članarine"
            value={unpaidCount}
            icon={<IconCreditCard />}
            variant={unpaidCount > 0 ? 'orange' : 'blue'}
            loading={loading}
            onClick={() => onNavigate?.('memberships')}
          />
          <StatCard
            label="Neaktivna djeca"
            value={inactiveList.length}
            icon={<IconAlert />}
            variant={inactiveList.length > 0 ? 'orange' : 'blue'}
            loading={loading}
            onClick={() => onNavigate?.('treninzi')}
          />
          <StatCard
            label="Novac kod trenera"
            value={`${fmt(coachMoney)} €`}
            icon={<IconBanknote />}
            variant={coachMoney > 0 ? 'orange' : 'blue'}
            loading={loading}
            onClick={() => onNavigate?.('memberships')}
          />
        </div>
      )}

      {/* ---- Membership chart (samo za vlasnika/koordinatora) ---- */}
      {!isTrener && (
        <div className="card ov-chart-card">
          <p className="ov-chart-title">Članarine — {currentMonthLabel()}</p>
          {!loading && (paidCount + unpaidCount > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={56}
                  outerRadius={84}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={v => (
                    <span style={{ fontSize: 12, color: '#64748b' }}>{v}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="ov-chart-empty">
              {loading ? 'Učitavanje...' : 'Nema podataka za ovaj mjesec.'}
            </div>
          )}
        </div>
      )}

      {/* ---- Grupe ---- */}
      <section className="ov-section">
        <h2 className="ov-section-title">
          {isTrener ? 'Moje grupe' : 'Grupe'}
        </h2>
        {loading ? (
          <div className="ov-skeleton" style={{ height: 88 }} />
        ) : groups.length === 0 ? (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {isTrener ? 'Nije ti dodjeljena nijedna grupa.' : 'Nema kreiranih grupa.'}
          </div>
        ) : (
          <div className="ov-groups-grid">
            {groups.map(g => (
              <div
                key={g.id}
                className="ov-group-card"
                onClick={() => onNavigate?.(isTrener ? 'treninzi' : 'people')}
              >
                <span className="ov-group-card__count">{groupMemberMap[g.id] ?? 0}</span>
                <span className="ov-group-card__name">{g.name}</span>
                <span className="ov-group-card__label">članova</span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

export default OverviewPage;
