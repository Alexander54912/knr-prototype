// map-ui.js — элементы поверх карты: «Искать в этой области», плашка режима, зум, геолокация, «Уточнить адрес».
// Положение по вертикали берётся из CSS-переменной --sheet-visible (её обновляет sheet.js).
import { icon } from './ui.js';
import { escapeHtml } from './format.js';

let root = null;

// handlers: { 'search-area', 'context-close', 'zoom-in', 'zoom-out', locate, address }
export function init(el, handlers) {
  root = el;
  root.innerHTML = `
    <button class="map-pill map-pill--search" type="button" data-act="search-area" hidden>
      ${icon('search')}<span>Искать в этой области</span>
    </button>
    <div class="map-context" hidden>
      <span class="map-context__text"></span>
      <button class="map-context__close" type="button" data-act="context-close" aria-label="Выйти из режима">${icon('close')}</button>
    </div>
    <div class="map-controls">
      <button class="map-ctl map-ctl--zoom" type="button" data-act="zoom-in" aria-label="Приблизить">${icon('plus')}</button>
      <button class="map-ctl map-ctl--zoom" type="button" data-act="zoom-out" aria-label="Отдалить">${icon('minus')}</button>
      <button class="map-ctl" type="button" data-act="locate" aria-label="Моё местоположение">${icon('locate')}</button>
    </div>
    <button class="map-pill map-pill--address" type="button" data-act="address">
      ${icon('locate')}<span>Уточнить адрес</span>
    </button>`;
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn && handlers[btn.dataset.act]) handlers[btn.dataset.act]();
  });
}

export function setSearchAreaVisible(visible) {
  if (root) root.querySelector('.map-pill--search').hidden = !visible;
}

// Плашка режима карты: текст или null (обычный режим).
export function setContext(text) {
  if (!root) return;
  const box = root.querySelector('.map-context');
  box.hidden = !text;
  root.toggleAttribute('data-context', Boolean(text));
  if (text) box.querySelector('.map-context__text').innerHTML = escapeHtml(text);
}
