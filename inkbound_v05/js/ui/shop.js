import { getStore } from '../data/dataStore.js';
import { addItem, removeItem } from '../core/playerSystem.js';

export function openShop(player, onBuy, onClose) {
  const { items } = getStore();
  const modal = document.getElementById('modal');
  const body  = document.getElementById('modal-body');
  const forSale = Object.values(items).filter(i => i.price > 0);

  function renderBuy() {
    body.innerHTML = `
      <h2>The Inkwell — Shop</h2>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
        <button class="btn btn-rest inv-btn" disabled>Buy</button>
        <button class="btn inv-btn" id="tabSell">Sell</button>
        <span style="flex:1;text-align:right;font-family:var(--hand);font-size:18px;color:var(--gold)">${player.money}c</span>
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

    document.getElementById('tabSell').onclick = renderSell;
    body.querySelectorAll('[data-buy]').forEach(b => {
      b.onclick = () => {
        const it = items[b.dataset.buy];
        if (!it || player.money < it.price) return;
        player.money -= it.price;
        addItem(player, it.id);
        onBuy(`Bought ${it.name}.`);
        renderBuy();
      };
    });
    document.getElementById('closeShop').onclick = () => {
      modal.style.display = 'none';
      onClose();
    };
  }

  function renderSell() {
    const sellable = player.inv
      .map(s => ({ s, it: items[s.id] }))
      .filter(({ it }) => it && it.price > 0);

    body.innerHTML = `
      <h2>The Inkwell — Shop</h2>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
        <button class="btn inv-btn" id="tabBuy">Buy</button>
        <button class="btn btn-rest inv-btn" disabled>Sell</button>
        <span style="flex:1;text-align:right;font-family:var(--hand);font-size:18px;color:var(--gold)">${player.money}c</span>
      </div>
      ${sellable.length ? sellable.map(({ s, it }) => {
        const sellPrice = Math.floor(it.price * 0.5);
        return `<div class="inv-row">
          <span><b>${it.name}</b>${s.qty > 1 ? ` ×${s.qty}` : ''}<br><small>${it.desc}</small></span>
          <span style="display:flex;align-items:center;gap:6px;">
            <span style="color:var(--gold);font-size:13px;">${sellPrice}c</span>
            <button class="btn btn-flee inv-btn" data-sell="${s.id}">Sell</button>
          </span>
        </div>`;
      }).join('') : '<p style="color:var(--ink-soft);font-style:italic;padding:8px 0">Nothing to sell.</p>'}
      <div style="margin-top:14px;text-align:right;">
        <button class="btn inv-btn" id="closeShop">Close</button>
      </div>`;

    document.getElementById('tabBuy').onclick = renderBuy;
    body.querySelectorAll('[data-sell]').forEach(b => {
      b.onclick = () => {
        const it = items[b.dataset.sell];
        if (!it) return;
        const sellPrice = Math.floor(it.price * 0.5);
        removeItem(player, b.dataset.sell);
        player.money += sellPrice;
        onBuy(`Sold ${it.name} for ${sellPrice}c.`);
        renderSell();
      };
    });
    document.getElementById('closeShop').onclick = () => {
      modal.style.display = 'none';
      onClose();
    };
  }

  modal.style.display = 'flex';
  renderBuy();
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
