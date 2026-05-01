const PROXIES = [
  u => u,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

async function fetchCSV(url) {
  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const t = await r.text();
      if (t.includes('accounts.google.com')) continue;
      return t;
    } catch { continue; }
  }
  throw new Error('All proxies failed — check Sheet is published as CSV');
}

function parseCSV(text) {
  const lines = text.replace(/\r/g,'').split('\n').filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((h,i) => [h,(cells[i]||'').trim()]));
  });
}

// CSV row → monster object
function toMonsters(rows) {
  const out = {};
  for (const r of rows) {
    if (!r.id) continue;
    out[r.id] = {
      name:r.name, sketch:r.sketch, lvl:+r.lvl,
      hp:+r.hp, atk:+r.atk, def:+r.def, spd:+r.spd, mag:+r.mag, res:+r.res,
      expR:[+r.exp_min,+r.exp_max], moneyR:[+r.money_min,+r.money_max],
      miniboss: r.is_miniboss==='TRUE', special: r.is_special==='TRUE',
      drops: (r.drops||'').split('|').filter(Boolean).map(d=>{const[id,ch]=d.split(':');return[id.trim(),+ch];}),
    };
  }
  return out;
}

// CSV row → item object
function toItems(rows) {
  const out = {};
  for (const r of rows) {
    if (!r.id) continue;
    const item = { id:r.id, name:r.name, type:r.type, price:+r.price, desc:r.desc };
    if (r.slot) item.slot = r.slot;
    // effect (consumables)
    const eh = +r.effect_hp||0, em = +r.effect_mp||0;
    if (eh||em) item.effect = {};
    if (eh) item.effect.hp = eh;
    if (em) item.effect.mp = em;
    // bonus (equip)
    const bkeys = ['hp','mp','atk','mag','def','res','spd','crit','dodge'];
    const bonus = {};
    for (const k of bkeys) { const v=+(r[`bonus_${k}`]||0); if(v) bonus[k]=v; }
    if (Object.keys(bonus).length) item.bonus = bonus;
    out[r.id] = item;
  }
  return out;
}

function baseUrl(u) { const i=u.indexOf('/pub'); return i===-1?null:u.substring(0,i+4); }
const tabUrl = (base,gid) => `${base}?gid=${gid}&single=true&output=csv`;

const SAVE_KEY = 'inkbound_sheet_url';
export const getSavedUrl = () => localStorage.getItem(SAVE_KEY)||'';
export const saveUrl = url => localStorage.setItem(SAVE_KEY, url);

export async function loadFromSheets(anyUrl) {
  const base = baseUrl(anyUrl);
  if (!base) throw new Error('Invalid URL — must be from Publish to web');

  // Fetch HTML index to discover gids by tab name
  const html = await fetchCSV(base+'?output=html').catch(()=>'');
  const gids = {};
  let pos=0;
  while(pos<html.length){
    const gi=html.indexOf('gid=',pos); if(gi===-1) break; pos=gi+4;
    let e=pos; while(e<html.length&&html[e]>='0'&&html[e]<='9') e++;
    const gid=html.substring(pos,e); if(!gid) continue;
    const ci=html.indexOf('>',gi), ci2=ci>-1?html.indexOf('<',ci):-1;
    if(ci>-1&&ci2>ci&&ci2-ci<60){
      const name=html.substring(ci+1,ci2).trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
      if(name) gids[name]=gid;
    }
  }

  const result = {};
  const targets = { monsters: toMonsters, items: toItems };
  for (const [tab, convert] of Object.entries(targets)) {
    const gid = gids[tab];
    if (!gid) continue;
    try {
      const rows = parseCSV(await fetchCSV(tabUrl(base, gid)));
      result[tab] = convert(rows);
    } catch(e) { console.warn(`Tab ${tab} failed:`, e.message); }
  }
  return result;
}
