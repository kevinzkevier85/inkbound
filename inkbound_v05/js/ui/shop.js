import { getStore } from '../data/dataStore.js';
import { addItem } from '../core/playerSystem.js';

export function openShop(player, onBuy, onClose) {
  const { items } = getStore();
  const modal = document.getElementById('modal');
  const body  = document.getElementById('modal-body');
  const forSale = Object.values(items).filter(i => i.price > 0);

  function render() {
    body.innerHTML = `
      <h2>The Inkwell — Shop</h2>
      <div style="margin-bottom:10px;font-family:var(--hand);font-size:18px;color:var(--ink-soft)">
        Coins: <b style="color:var(--gold)">${player.money}</b>
      </div>
      ${forSale.map(it => `
        <div class="inv-row">
          <span><b>${it.name}</b><br><small>${it.desc}</small></span>
          <span style="display:flex;align-items:center;gap:6px;">
            <span style="color:var(--gold);font-weight:bold;font-size:13px;">${it.price}c</span>
            <button class="btn btn-skill inv-btn" data-buy="${it.id}"
              ${player.money < it.price ? 'disabled' : ''}>Buy</button>
          </span>
        </div>`).join('')}
      <div style="margin-top:14px;text-align:right;">
        <button class="btn inv-btn" id="closeShop">Close</button>
      </div>`;

    body.querySelectorAll('[data-buy]').forEach(b => {
      b.onclick = () => {
        const it = items[b.dataset.buy];
        if (!it || player.money < it.price) return;
        player.money -= it.price;
        addItem(player, it.id);
        onBuy(`Bought ${it.name}.`);
        render();
      };
    });
    document.getElementById('closeShop').onclick = () => {
      modal.style.display = 'none';
      onClose();
    };
  }

  modal.style.display = 'flex';
  render();
}

export function openSoulShop(player, onBuy, onClose) {
  const { items } = getStore();
  const modal = document.getElementById('modal');
  const body  = document.getElementById('modal-body');
  const soulItems = Object.values(items).filter(i => i.soulCost > 0);

  function render() {
    body.innerHTML = `
      <h2>Soul Sanctum</h2>
      <div style="margin-bottom:10px;font-family:var(--hand);font-size:18px;color:var(--purple)">
        Soul: <b>${player.soul}</b>
      </div>
      ${soulItems.map(it => {
        const owned = player.inv.some(s => s.id === it.id);
        return `
        <div class="inv-row">
          <span><b>${it.name}</b><br><small>${it.desc}</small></span>
          <span style="display:flex;align-items:center;gap:6px;">
            <span style="color:var(--purple);font-weight:bold;font-size:13px;">${it.soulCost} Soul</span>
            <button class="btn btn-soul inv-btn" data-soul="${it.id}"
              ${player.soul < it.soulCost || owned ? 'disabled' : ''}>${owned ? 'Owned' : 'Buy'}</button>
          </span>
        </div>`;
      }).join('')}
      <div style="margin-top:14px;text-align:right;">
        <button class="btn inv-btn" id="closeSoulShop">Close</button>
      </div>`;

    body.querySelectorAll('[data-soul]').forEach(b => {
      b.onclick = () => {
        const it = items[b.dataset.soul];
        if (!it || player.soul < it.soulCost) return;
        player.soul -= it.soulCost;
        addItem(player, it.id);
        onBuy(`Obtained ${it.name}.`);
        render();
      };
    });
    document.getElementById('closeSoulShop').onclick = () => {
      modal.style.display = 'none';
      onClose();
    };
  }

  modal.style.display = 'flex';
  render();
}
