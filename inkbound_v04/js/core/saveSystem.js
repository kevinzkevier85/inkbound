const KEY = 'inkbound_save_v04';

export function save(player) {
  localStorage.setItem(KEY, JSON.stringify(player));
}

export function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (!p?.name || !p?.cls || !p?.level) return null;
    return p;
  } catch { return null; }
}

export function hasSave() { return !!localStorage.getItem(KEY); }
export function clear()   { localStorage.removeItem(KEY); }
