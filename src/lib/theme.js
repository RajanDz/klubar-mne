export const DEFAULT_THEME = {
  mode:     'light',
  primary:  '#c94a18',
  bg:       '#f4f3ef',
  textMode: 'auto',
};

export const DARK_BG_DEFAULT  = '#0f172a';
export const LIGHT_BG_DEFAULT = '#f4f3ef';

function darkenHex(hex, amount) {
  const c = hex.replace('#', '');
  const r = Math.max(0, parseInt(c.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(c.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(c.slice(4, 6), 16) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexLuminance(hex) {
  const c = hex.replace('#', '');
  const toL = x => { const v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * toL(c.slice(0, 2)) + 0.7152 * toL(c.slice(2, 4)) + 0.0722 * toL(c.slice(4, 6));
}

export function applyThemeVars({ mode, primary, bg, textMode } = {}) {
  const root = document.documentElement;

  const resolvedMode = mode || DEFAULT_THEME.mode;
  const isDark = resolvedMode === 'dark';

  /* 1 — Surface i border boje po modu */
  if (isDark) {
    root.style.setProperty('--surface',       '#1e293b');
    root.style.setProperty('--surface-2',     '#152032');
    root.style.setProperty('--border',        '#334155');
    root.style.setProperty('--border-strong', '#475569');
  } else {
    root.style.setProperty('--surface',       '#ffffff');
    root.style.setProperty('--surface-2',     '#faf9f7');
    root.style.setProperty('--border',        '#e4e0d9');
    root.style.setProperty('--border-strong', '#cac6be');
  }

  /* 2 — Primarna boja */
  const p = primary || DEFAULT_THEME.primary;
  root.style.setProperty('--primary',       p);
  root.style.setProperty('--primary-hover', darkenHex(p, 20));
  root.style.setProperty('--header-bg',     darkenHex(p, 55));

  /* 3 — Pozadinska boja (sa fallback-om za mod) */
  const defaultBg = isDark ? DARK_BG_DEFAULT : LIGHT_BG_DEFAULT;
  const b = bg || defaultBg;
  root.style.setProperty('--bg', b);

  /* 4 — Boja slova */
  const tm = textMode || DEFAULT_THEME.textMode;
  if (tm === 'dark') {
    root.style.setProperty('--text',        '#111111');
    root.style.setProperty('--text-muted',  '#6b6560');
    root.style.setProperty('--text-subtle', '#9a9590');
  } else if (tm === 'light') {
    root.style.setProperty('--text',        '#f8fafc');
    root.style.setProperty('--text-muted',  '#cbd5e1');
    root.style.setProperty('--text-subtle', '#94a3b8');
  } else {
    /* Auto: na osnovu luminance pozadine */
    const lum = hexLuminance(b);
    if (lum < 0.4) {
      root.style.setProperty('--text',        '#f8fafc');
      root.style.setProperty('--text-muted',  '#cbd5e1');
      root.style.setProperty('--text-subtle', '#94a3b8');
    } else {
      root.style.setProperty('--text',        '#111111');
      root.style.setProperty('--text-muted',  '#6b6560');
      root.style.setProperty('--text-subtle', '#9a9590');
    }
  }
}
