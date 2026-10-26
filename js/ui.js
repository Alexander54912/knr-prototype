// ui.js — общие UI-помощники для экранов обоих треков (возвращают HTML-строки).
import { escapeHtml, formatRate } from './format.js';
import { getChain } from './data.js';

// --- Иконки (inline SVG, цвет = currentColor) ------------------------------
const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.4A5 5 0 0 1 12 6.6a5 5 0 0 1 9.2 4C19.5 15.4 12 20 12 20z"/>',
  'heart-filled': '<path fill="currentColor" d="M12 20s-7.5-4.6-9.2-9.4A5 5 0 0 1 12 6.6a5 5 0 0 1 9.2 4C19.5 15.4 12 20 12 20z"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18v2M17 17h3v3"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".8" fill="currentColor"/><circle cx="4" cy="12" r=".8" fill="currentColor"/><circle cx="4" cy="18" r=".8" fill="currentColor"/>',
  map: '<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"/><path d="M9 4v14M15 6v14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  'chevron-right': '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  'chevron-down': '<path d="M6 9.5l6 6 6-6"/>',
  locate: '<path fill="currentColor" stroke="none" d="M20.4 3.6L3.9 10.4c-.8.3-.7 1.4.1 1.6l6.3 1.7 1.7 6.3c.2.8 1.3.9 1.6.1l6.8-16.5z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4.5 3 3 2.5-2.5L19.5 17"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2 2 0 0 1 18 19.5 15.5 15.5 0 0 1 4.5 6 2 2 0 0 1 6.5 4z"/>',
};

export function icon(name, cls = '') {
  const p = PATHS[name] || '';
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

// --- Логотип ----------------------------------------------------------------
// visual = data.getPlaceVisual(place) или { logo, letters, color, textColor, icon }
export function logo(visual, size = 'm') {
  const v = visual || {};
  const style = `--logo-bg:${v.color || '#8A8A8E'};--logo-fg:${v.textColor || '#FFFFFF'}`;
  // Буквы — всегда под картинкой: если картинка не загрузится, останутся буквы.
  let inner = `<span class="logo__letters">${escapeHtml(v.letters || '')}</span>`;
  let mod = '';
  if (v.logo) {
    inner += `<img class="logo__img" src="${escapeHtml(v.logo)}" alt="" loading="lazy" onerror="this.remove()">`;
  } else if (v.icon) {
    // Иконка категории: буквы скрыты, пока иконка на месте.
    mod = ' logo--icon';
    inner += `<img class="logo__icon" src="${escapeHtml(v.icon)}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('logo--icon');this.remove()">`;
  }
  return `<span class="logo logo--${size}${mod}" style="${style}">${inner}</span>`;
}

// --- Товары -----------------------------------------------------------------
// Изображение товара или плитка-заглушка цвета категории с названием бренда.
export function productImage(offer, size = 'm') {
  const bg = offer.bg_color || '#3A3A3C';
  const brand = escapeHtml(offer.brand || offer.short_title || '');
  const img = offer.image
    ? `<img class="pimg__img" src="${escapeHtml(offer.image)}" alt="" loading="lazy" onerror="this.remove()">`
    : '';
  return `<span class="pimg pimg--${size}" style="--pimg-bg:${bg}"><span class="pimg__pack"></span><span class="pimg__brand">${brand}</span>${img}</span>`;
}

// Коротко, где действует универсальная акция.
export function shortWhere(offer) {
  const w = offer.where || {};
  if (w.type === 'chain') return offer.where_text || '';
  const ch = w.channels || [];
  let text = ch.includes('offline') && ch.includes('online') ? 'Офлайн и онлайн'
    : ch.includes('online') ? 'Только онлайн' : 'Только офлайн';
  // Исключения: маркетплейсы — одним словом, сети — по названию («Лента»), а не по id.
  const marketplaces = ['Ozon', 'Wildberries', 'Яндекс Маркет', 'Мегамаркет'];
  const ex = w.excluded || [];
  const parts = [];
  if (ex.some((x) => marketplaces.includes(x))) parts.push('маркетплейсов');
  const chains = ex.filter((x) => !marketplaces.includes(x)).map((id) => getChain(id)?.name || id);
  if (chains.length === 1) parts.push(`сети «${chains[0]}»`);
  else if (chains.length) parts.push(`сетей ${chains.map((n) => `«${n}»`).join(', ')}`);
  if (parts.length) text += `, кроме ${parts.join(' и ')}`;
  return text;
}

// Карточка акции для сетки 2 в ряд.
export function productCard(offer, { where = false } = {}) {
  return `
    <button class="product-card" type="button" data-offer-id="${escapeHtml(offer.id)}">
      <span class="product-card__img">
        ${productImage(offer)}
        <span class="badge badge--cashback product-card__badge">${escapeHtml(formatRate(offer))}</span>
      </span>
      <span class="product-card__title">${escapeHtml(offer.short_title)}</span>
      <span class="product-card__meta"><span class="tag-receipt">По чеку</span></span>
      ${where ? `<span class="product-card__where">${escapeHtml(shortWhere(offer))}</span>` : ''}
    </button>`;
}

// --- Общие блоки ------------------------------------------------------------
// Пустое состояние; кнопки получают data-action (обработчик вешает экран).
export function emptyState({ title, text = '', actions = [] }) {
  const btns = actions.map((a, i) =>
    `<button class="btn ${i === 0 ? 'btn--secondary' : 'btn--ghost'}" type="button" data-action="${escapeHtml(a.action)}">${escapeHtml(a.label)}</button>`).join('');
  return `
    <div class="empty">
      <div class="empty__title">${escapeHtml(title)}</div>
      ${text ? `<div class="empty__text">${escapeHtml(text)}</div>` : ''}
      ${btns ? `<div class="empty__actions">${btns}</div>` : ''}
    </div>`;
}

// Ряд чипсов: items = [{ id, name }], activeId — выбранный (null — ни один).
export function chips(items, activeId, { extra = '' } = {}) {
  const html = items.map((c) =>
    `<button class="chip${c.id === activeId ? ' is-active' : ''}" type="button" data-chip-id="${escapeHtml(c.id)}">${escapeHtml(c.name)}</button>`).join('');
  return `<div class="chips">${html}${extra}</div>`;
}

// Поле поиска.
export function searchField({ placeholder = 'Поиск', value = '' } = {}) {
  return `
    <label class="search">
      ${icon('search', 'search__icon')}
      <input class="search__input" type="search" inputmode="search" enterkeyhint="search" autocomplete="off"
        placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}">
      <button class="search__clear" type="button" aria-label="Очистить"${value ? '' : ' hidden'}>${icon('close')}</button>
    </label>`;
}

// Тост на 2,5 секунды.
let toastTimer = null;
export function toast(text) {
  const host = document.getElementById('toasts');
  if (!host) return;
  host.innerHTML = `<div class="toast" role="status">${escapeHtml(text)}</div>`;
  const el = host.firstElementChild;
  requestAnimationFrame(() => el.classList.add('is-visible'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

export const ui = { icon, logo, productImage, productCard, shortWhere, emptyState, chips, searchField, toast };
