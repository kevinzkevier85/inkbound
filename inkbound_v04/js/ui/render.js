import { derived, expForLevel } from '../core/playerSystem.js';
import { getStore } from '../data/dataStore.js';

// ── Character sheet (left column) ─────────────────────────────
export function renderPlayer(player) {
  const d = derived(player);
  const need = expForLevel(player.level);
  const hpPct  = (player.hp  / d.hpMax * 100).toFixed(1);
  const mpPct  = (player.mp  / d.mpMax * 100).toFixed(1);
  const expPct = (player.exp / need    * 100).toFixed(1);

  document.getElementById('char-name').textContent  = player.name;
  document.getElementById('char-class').textContent = `${player.cls} · Lv.${player.level}`;

  setBar('hp',  player.hp,  d.hpMax,  hpPct);
  setBar('mp',  player.mp,  d.mpMax,  mpPct);
  setBar('exp', player.exp, need,     expPct);

  document.getElementById('stats').innerHTML = [
    ['STR', d.atk], ['DEX', d.spd], ['INT', d.mag],
    ['DEF', d.def], ['RES', d.res], ['CRIT', d.crit + '%'], ['DODGE', d.dodge + '%'],
  ].map(([k,v]) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`).join('');

  document.getElementById('currency').textContent =
    `💰 ${player.money}  🥇 ${player.gold}  💎 ${player.gem}  👁 ${player.soul}`;
}

function setBar(name, cur, max, pct) {
  document.getElementById(`${name}-text`).textContent = `${cur}/${max}`;
  document.getElementById(`${name}-bar`).style.width   = `${pct}%`;
}

// ── Enemy card ─────────────────────────────────────────────────
export function renderEnemy(enemy) {
  const el = document.getElementById('enemy-area');
  if (!enemy) { el.innerHTML = ''; return; }
  const pct = Math.max(0, enemy.hp / enemy.hpMax * 100).toFixed(1);
  el.innerHTML = `
    <div class="enemy-card ${enemy.miniboss ? 'miniboss' : ''}">
      <div class="enemy-sketch">${enemy.sketch}</div>
      <div class="enemy-name">${enemy.name}</div>
      <div class="enemy-lvl">Lv. ${enemy.lvl}</div>
      <div class="bar-label"><span>HP</span><span>${Math.max(0,enemy.hp)}/${enemy.hpMax}</span></div>
      <div class="bar"><span class="bar-fill hp-fill" style="width:${pct}%"></span></div>
    </div>`;
}

// ── Battle / Explore buttons ───────────────────────────────────
export function renderActions(player, enemy, callbacks) {
  const bar = document.getElementById('action-bar');
  bar.innerHTML = '';

  if (enemy) {
    // Combat mode
    addBtn(bar, '⚔ ATTACK', 'btn-attack', () => callbacks.attack(null));
    const cls = getStore().classes[player.cls];
    for (const sId of cls.skills) {
      const sk = getStore().skills[sId];
      if (!sk) continue;
      const b = addBtn(bar, `${sk.name}${sk.mp ? ` ·${sk.mp}MP` : ''}`, 'btn-skill', () => callbacks.attack(sId));
      if (player.mp < sk.mp) b.disabled = true;
    }
    addBtn(bar, '🏃 FLEE', 'btn-flee', callbacks.flee);
  } else {
    // Explore mode
    addBtn(bar, '⚔ EXPLORE', 'btn-attack', callbacks.explore);
    addBtn(bar, '🍃 Rest', 'btn-rest', callbacks.rest);
  }
}

function addBtn(parent, label, cls, fn) {
  const b = document.createElement('button');
  b.className = `btn ${cls}`;
  b.textContent = label;
  b.onclick = fn;
  parent.appendChild(b);
  return b;
}

// ── Log ────────────────────────────────────────────────────────
export function addLog(msg, type = '') {
  const log = document.getElementById('log');
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

export function clearLog() {
  document.getElementById('log').innerHTML = '';
}

// ── Inventory panel ────────────────────────────────────────────
export function renderInventory(player, onUse, onEquip) {
  const el = document.getElementById('inventory-list');
  if (!el) return;
  const { items } = getStore();
  // Equipped panel
  const slots = ['weapon','armor','acc'];
  const eqHtml = slots.map(slot => {
    const id = player.equip[slot];
    const name = id && items[id] ? items[id].name : '—';
    return `<div class="equip-slot"><span class="slot-name">${slot}</span><span>${name}</span></div>`;
  }).join('');
  // Inventory list
  if (!player.inv.length) { el.innerHTML = eqHtml + '<i style="color:var(--ink-soft)">Pack empty.</i>'; return; }
  const rows = player.inv.map(s => {
    const it = items[s.id]; if (!it) return '';
    const isEquipped = Object.values(player.equip).includes(s.id);
    const tag = isEquipped ? ' <span class="eq-tag">EQ</span>' : '';
    if (it.type === 'consume')
      return `<div class="inv-row"><span><b>${it.name}</b> ×${s.qty}${tag}<br><small>${it.desc}</small></span>
        <button class="btn btn-rest inv-btn" data-use="${s.id}">Use</button></div>`;
    if (it.type === 'equip')
      return `<div class="inv-row"><span><b>${it.name}</b>${tag}<br><small>${it.desc}</small></span>
        <button class="btn btn-skill inv-btn" data-eq="${s.id}">${isEquipped?'Unequip':'Equip'}</button></div>`;
    return '';
  }).join('');
  el.innerHTML = eqHtml + rows;
  el.querySelectorAll('[data-use]').forEach(b => b.onclick = () => onUse(b.dataset.use));
  el.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => onEquip(b.dataset.eq));
}
