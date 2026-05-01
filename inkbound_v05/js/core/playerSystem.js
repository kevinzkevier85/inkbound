import { clamp } from '../utils/random.js';
import { getStore } from '../data/dataStore.js';

export function derived(p) {
  const cfg = getStore().config;
  const items = getStore().items;
  const b = { hp:0,mp:0,atk:0,mag:0,def:0,res:0,spd:0,crit:0,dodge:0 };
  for (const id of Object.values(p.equip)) {
    if (!id) continue;
    const item = items[id];
    if (!item) continue;
    if (item.bonus)        Object.entries(item.bonus).forEach(([k,v])        => { if (k in b) b[k] += v; });
    if (item.bonusPerLevel) Object.entries(item.bonusPerLevel).forEach(([k,v]) => { if (k in b) b[k] += Math.floor(v * p.level); });
  }
  const S=p.str, D=p.dex, I=p.int, V=p.vit, W=p.wis, L=p.luck;
  return {
    hpMax:  30 + V*cfg.hp_per_vit  + p.level*cfg.hp_per_level  + b.hp,
    mpMax:  10 + W*cfg.mp_per_wis  + I*cfg.mp_per_int + p.level*cfg.mp_per_level + b.mp,
    atk:    S*2 + b.atk,
    mag:    I*2 + b.mag,
    def:    Math.floor(V*1.2) + b.def,
    res:    Math.floor(W*1.2) + b.res,
    spd:    D   + b.spd,
    crit:   5 + Math.floor(L*0.8) + b.crit,
    dodge:  Math.floor(D*0.4)     + b.dodge,
  };
}

function applyGrowth(p, growth) {
  for (const k of Object.keys(growth)) p[k] += growth[k];
}

export function makeNew(name, cls) {
  const classes = getStore().classes;
  const maps    = getStore().maps;
  const firstMap = Object.keys(maps)[0] || 'meadow';
  const p = {
    name, cls, level: 1, exp: 0,
    str: 5, dex: 5, int: 5, vit: 5, wis: 5, luck: 5,
    money: 50, gold: 0, gem: 0, soul: 0, honor: 0,
    inv: [{ id: 'potion_s', qty: 3 }],
    equip: { weapon: null, armor: null, acc: null },
    map: firstMap,
    hp: 0, mp: 0,
    kills: {},
    quests: { completed: [] },
    hexedFoe: 0,
  };
  applyGrowth(p, classes[cls].growth);
  recompute(p, true);
  return p;
}

export function recompute(p, fill = false) {
  const d = derived(p);
  if (fill) { p.hp = d.hpMax; p.mp = d.mpMax; }
  p.hp = clamp(p.hp, 0, d.hpMax);
  p.mp = clamp(p.mp, 0, d.mpMax);
}

export function expForLevel(lv) {
  const c = getStore().config;
  return c.exp_curve_base + (lv - 1) * c.exp_curve_linear + lv * lv * c.exp_curve_quad;
}

export function gainExp(p, amount) {
  const logs = [`Gained ${amount} EXP.`];
  p.exp += amount;
  while (p.exp >= expForLevel(p.level)) {
    p.exp -= expForLevel(p.level);
    p.level += 1;
    applyGrowth(p, getStore().classes[p.cls].growth);
    recompute(p, true);
    logs.push(`★ Level up! Now level ${p.level}.`);
    if (p.level === 5)  logs.push('A new path opens… (Class Change available)');
    if (p.level === 12) logs.push('Mastery beckons… (Tier 3 available)');
  }
  return logs;
}

export function classChange(p, newCls) {
  const classes = getStore().classes;
  const info = classes[newCls];
  if (!info) return 'Unknown class.';
  p.cls = newCls;
  applyGrowth(p, info.growth);
  recompute(p, true);
  return `You are now a ${newCls}!`;
}

export function availableClassChanges(p) {
  const classes = getStore().classes;
  const cur = classes[p.cls];
  if (!cur) return [];
  return Object.entries(classes).filter(([, info]) => {
    if (info.hidden) return false;
    if (info.tier === 2) return p.level >= 5  && info.parent === p.cls;
    if (info.tier === 3) return p.level >= 12 && info.parent === p.cls;
    return false;
  }).map(([id]) => id);
}

export function addItem(p, id, qty = 1) {
  const slot = p.inv.find(s => s.id === id);
  if (slot) slot.qty += qty; else p.inv.push({ id, qty });
}

export function removeItem(p, id, qty = 1) {
  const idx = p.inv.findIndex(s => s.id === id);
  if (idx === -1) return false;
  p.inv[idx].qty -= qty;
  if (p.inv[idx].qty <= 0) p.inv.splice(idx, 1);
  return true;
}

export function useItem(p, id) {
  const { items } = getStore();
  const item = items[id];
  if (!item || item.type !== 'consume') return null;
  if (!removeItem(p, id)) return null;
  const d = derived(p);
  if (item.effect?.hp) p.hp = Math.min(d.hpMax, p.hp + item.effect.hp);
  if (item.effect?.mp) p.mp = Math.min(d.mpMax, p.mp + item.effect.mp);
  return `Used ${item.name}.`;
}

export function toggleEquip(p, id) {
  const item = getStore().items[id];
  if (!item || item.type !== 'equip') return null;
  const slot = item.slot;
  if (p.equip[slot] === id) { p.equip[slot] = null; return `Unequipped ${item.name}.`; }
  p.equip[slot] = id;
  recompute(p);
  return `Equipped ${item.name}.`;
}
