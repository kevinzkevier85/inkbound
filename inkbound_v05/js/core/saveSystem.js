const KEY = 'inkbound_save_v05';

export function save(player) {
  localStorage.setItem(KEY, JSON.stringify(player));
}

export function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (!p?.name || !p?.cls || !p?.level) return null;
    // Patch missing fields from older saves
    if (!p.kills)           p.kills = {};
    if (!p.quests)          p.quests = { completed: [] };
    if (!p.soul)            p.soul = 0;
    if (!p.honor)           p.honor = 0;
    if (p.hexedFoe == null) p.hexedFoe = 0;
    return p;
  } catch { return null; }
}

export function hasSave() { return !!localStorage.getItem(KEY); }
export function clear()   { localStorage.removeItem(KEY); }
