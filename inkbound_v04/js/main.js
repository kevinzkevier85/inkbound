import { loadAll, getStore } from './data/dataStore.js';
import { loadFromSheets, getSavedUrl, saveUrl } from './data/sheetsLoader.js';
import { openShop } from './ui/shop.js';
import { save, load, hasSave, clear } from './core/saveSystem.js';
import { makeNew, recompute, useItem, toggleEquip } from './core/playerSystem.js';
import { spawnEncounter, playerAttack, enemyAttack, checkEnd } from './core/combatSystem.js';
import { renderPlayer, renderEnemy, renderActions, renderInventory, addLog, clearLog } from './ui/render.js';

let player = null;
let enemy  = null;

// ── Boot ───────────────────────────────────────────────────────
async function init() {
  addLog('Loading data…', 'system');
  const base = new URL('.', import.meta.url).href.replace(/\/$/,'');
  await loadAll(base);
  // Auto-load Sheets data if URL saved
  const sheetUrl = getSavedUrl();
  if (sheetUrl) {
    try {
      const data = await loadFromSheets(sheetUrl);
      const store = getStore();
      if (data.monsters) store.monsters = data.monsters;
      if (data.items)    store.items    = data.items;
      addLog('Sheets data loaded ✅', 'system');
    } catch(e) { addLog('Sheets failed — using defaults.', 'system'); }
  }

  if (hasSave()) {
    const p = load();
    if (p) {
      player = p;
      import('./core/playerSystem.js').then(({ recompute }) => { recompute(player); tick(); });
      addLog(`Welcome back, ${p.name}.`, 'system');
      return;
    }
  }
  addLog('Data loaded. Choose your class.', 'system');
  showCharCreate();
}

// ── Character creation ─────────────────────────────────────────
function showCharCreate() {
  const modal  = document.getElementById('modal');
  const body   = document.getElementById('modal-body');
  const classes = getStore().classes;

  body.innerHTML = `
    <h2>Begin Anew</h2>
    <label>Name: <input id="char-name-input" value="Adventurer" maxlength="14"></label>
    <div style="margin-top:14px;">
      ${Object.entries(classes)
        .filter(([, c]) => c.tier === 1)
        .map(([id, c]) => `
          <div class="class-card" data-cls="${id}">
            <b>${id}</b> — <i>${c.desc}</i>
          </div>`).join('')}
    </div>`;

  modal.style.display = 'flex';

  body.querySelectorAll('.class-card').forEach(card => {
    card.onclick = () => {
      const name = document.getElementById('char-name-input').value.trim() || 'Adventurer';
      player = makeNew(name, card.dataset.cls);
      // starter gear for testing
      player.inv.push({ id:'rusty_sword', qty:1 });
      modal.style.display = 'none';
      clearLog();
      addLog(`The book opens. ${player.name} the ${player.cls} steps into the page.`, 'system');
      tick();
    };
  });
}

// ── Main render tick ───────────────────────────────────────────
function tick() {
  renderPlayer(player);
  renderEnemy(enemy);
  renderInventory(player, handleUseItem, handleEquip);
  renderActions(player, enemy, {
    explore, rest, attack, flee,
  });
}

// ── Actions ────────────────────────────────────────────────────
function explore() {
  enemy = spawnEncounter(player.map, player.level);
  if (!enemy) { addLog('Nothing stirs.', 'system'); return; }
  addLog(`A ${enemy.name} (Lv.${enemy.lvl}) appears!`, enemy.miniboss ? 'special' : 'system');
  tick();
}

function rest() {
  const { derived: d } = player; // avoid re-import; just nudge HP
  import('./core/playerSystem.js').then(({ derived }) => {
    const d = derived(player);
    const dh = Math.floor(d.hpMax * 0.2);
    const dm = Math.floor(d.mpMax * 0.2);
    player.hp = Math.min(d.hpMax, player.hp + dh);
    player.mp = Math.min(d.mpMax, player.mp + dm);
    addLog(`You rest. (+${dh} HP, +${dm} MP)`, 'heal');
    tick();
  });
}

function attack(skillId) {
  if (!enemy) return;

  // Player turn
  const { logs: pLogs } = playerAttack(player, enemy, skillId);
  pLogs.forEach(m => addLog(m, 'combat'));

  // Check win
  const { result, rewardLogs } = checkEnd(player, enemy);
  if (result === 'win') {
    rewardLogs.forEach(m => addLog(m, 'loot'));
    enemy = null; save(player); tick(); return;
  }
  if (result === 'lose') {
    rewardLogs.forEach(m => addLog(m, 'system'));
    // Revive at half HP
    import('./core/playerSystem.js').then(({ derived }) => {
      player.hp = Math.max(1, Math.floor(derived(player).hpMax / 2));
      enemy = null; tick();
    });
    return;
  }

  // Enemy turn
  const { logs: eLogs } = enemyAttack(player, enemy);
  eLogs.forEach(m => addLog(m, 'combat'));

  // Check lose after enemy attacks
  const { result: r2, rewardLogs: r2Logs } = checkEnd(player, enemy);
  if (r2 === 'lose') {
    r2Logs.forEach(m => addLog(m, 'system'));
    import('./core/playerSystem.js').then(({ derived }) => {
      player.hp = Math.max(1, Math.floor(derived(player).hpMax / 2));
      enemy = null; tick();
    });
    return;
  }

  tick();
}

function flee() {
  addLog('You slip away.', 'system');
  enemy = null;
  tick();
}


function handleUseItem(id) {
  const msg = useItem(player, id);
  if (msg) { addLog(msg, 'heal'); tick(); }
}

function handleEquip(id) {
  const msg = toggleEquip(player, id);
  if (msg) { addLog(msg, 'system'); tick(); }
}

window.openShop   = () => openShop(player, msg => { addLog(msg,'loot'); save(player); tick(); }, tick);
window.connectSheets = () => {
  const url = prompt('Paste your Google Sheets Publish-to-web URL:');
  if (!url) return;
  saveUrl(url);
  addLog('URL saved — reloading data...','system');
  loadFromSheets(url).then(data => {
    const store = getStore();
    if (data.monsters) store.monsters = data.monsters;
    if (data.items)    store.items    = data.items;
    addLog('Sheets loaded ✅','loot');
    tick();
  }).catch(e => addLog('Error: '+e.message,'system'));
};

window.gameSave  = () => { save(player); addLog('Game saved.','system'); };
window.gameLoad  = () => { const p=load(); if(p){player=p; import('./core/playerSystem.js').then(({recompute})=>{recompute(player);tick();addLog('Loaded.','system');}); } };
window.gameReset = () => { if(confirm('New game?')){clear();location.reload();} };

// ── Start ──────────────────────────────────────────────────────
init();
