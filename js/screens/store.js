// store.js — карточка магазина (трек A, SPEC п.7–9, 14, 17).
// Один шаблон для входа из списка и из пина. Сразу показывает выгоду: обычный оффер и каталог чековых.
import { addressLine } from '../rows.js';
import { catalogHTML, updateCatalog, bindCatalog } from './store-catalog.js';

export const presentation = 'sheet';
// Из списка — почти на весь экран (место товарам), из пина и карты — на 2/3, чтобы был виден выбранный пин.
export const sheetPosition = (params) => (params.from === 'pin' || params.from === 'map' ? 'mid' : 'full');

// Карточка обычного оффера, как в проде: «Кэшбэк 70% · За одну покупку на кассе · Максимум — 600 бонусов».
function regularHTML(place, ctx) {
  const { data, format, ui } = ctx;
  const ro = data.getRegularOffer(place);
  if (!ro) return '';
  const cat = data.getCategory(place.category_id);
  return `
    <div class="card regular-offer">
      ${ui.logo({ color: cat?.color, letters: cat?.name?.charAt(0) || '%', icon: cat?.icon }, 'm')}
      <div class="regular-offer__body">
        <div class="regular-offer__title">${format.escapeHtml(format.formatBenefit(ro))}</div>
        <div class="regular-offer__text">${format.escapeHtml(ro.condition)}</div>
        <div class="regular-offer__text">${format.escapeHtml(format.formatDeadline(ro))}</div>
        ${ro.max_bonus ? `<div class="regular-offer__note">Максимум — ${format.escapeHtml(format.formatBonus(ro.max_bonus))}</div>` : ''}
      </div>
    </div>`;
}

// Информация о месте (для кафе и мест без чековых акций — сразу под оффером).
function infoHTML(place, ctx) {
  const { format, ui } = ctx;
  const line = (ic, text) => `<div class="place-info__line">${ui.icon(ic)}<span>${format.escapeHtml(text)}</span></div>`;
  return `
    <div class="card place-info">
      <div class="place-info__title">О месте</div>
      ${line('pin', place.address)}
      ${place.hours ? line('clock', place.hours) : ''}
      ${place.phone ? line('phone', place.phone) : ''}
    </div>`;
}

function headHTML(place, ctx) {
  const { data, format, ui, geo, state } = ctx;
  const chain = place.chain_id ? data.getChain(place.chain_id) : null;
  const brand = place.brand_id ? data.getBrand(place.brand_id) : null;
  const title = chain?.name || brand?.name || place.name;
  const distance = geo.distanceM(place, state.get('location'));
  const siblings = data.getSiblingsNear(place, state.get('location'), 2).length > 1;
  return `
    <div class="store-head">
      ${ui.logo(data.getPlaceVisual(place), 'l')}
      <div class="store-head__body">
        <h2 class="store-head__title">${format.escapeHtml(title)}</h2>
        <div class="store-head__address">${addressLine(place, distance)}</div>
        <div class="store-head__links">
          ${siblings ? `<button class="link" type="button" data-other-address>Выбрать другой адрес</button>` : ''}
          <button class="link" type="button" data-about>О магазине</button>
        </div>
      </div>
    </div>`;
}

// Нарисовать всё содержимое для текущего места (фильтры каталога сохраняются в ctx.instance).
function draw(container, ctx) {
  const inst = ctx.instance;
  const place = ctx.data.getPlace(inst.placeId);
  const catalog = ctx.data.getStoreCatalog(place);
  inst.catalog = catalog;
  const body = container.querySelector('.store-body');
  body.innerHTML = `
    ${headHTML(place, ctx)}
    ${regularHTML(place, ctx)}
    ${catalog.length ? catalogHTML(catalog, inst.filters, ctx) : infoHTML(place, ctx)}`;
  container.querySelector('.screen-head__title').textContent = place.name;
  if (catalog.length) {
    updateCatalog(body, catalog, inst.filters, inst.highlightId, ctx);
    bindCatalog(body, () => inst.catalog, inst.filters, () => inst.highlightId, ctx);
  }
}

export function render(container, params, ctx) {
  const { router, map, data } = ctx;
  const place = data.getPlace(params.placeId);
  if (!place) {
    container.innerHTML = ctx.ui.emptyState({ title: 'Магазин не найден', actions: [{ label: 'Назад', action: 'back' }] });
    container.addEventListener('click', () => router.back());
    return;
  }
  Object.assign(ctx.instance, {
    placeId: place.id,
    highlightId: params.highlightOfferId || null,
    filters: { query: '', category: null },
  });

  container.innerHTML = `
    <div class="screen-head" data-sheet-drag>
      <button class="icon-btn screen-head__back" type="button" data-back aria-label="Назад">${ctx.ui.icon('back')}</button>
      <div class="screen-head__title"></div>
    </div>
    <div class="store-body"></div>`;
  draw(container, ctx);
  // Шапка: название появляется, когда шапка магазина ушла под скролл.
  container.addEventListener('scroll', () => {
    container.classList.toggle('is-scrolled', container.scrollTop > 70);
  }, { passive: true });

  container.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { router.back(); return; }
    if (e.target.closest('[data-other-address]')) { router.push('address-picker', { placeId: ctx.instance.placeId }); return; }
    if (e.target.closest('[data-about]')) { router.push('about-place', { placeId: ctx.instance.placeId }); return; }
    const card = e.target.closest('[data-offer-id]');
    if (card) router.push('offer', { offerId: card.dataset.offerId, placeId: ctx.instance.placeId });
  });

  map.focusPlace(place.id);
}

export function destroy(container, ctx) {
  ctx.map.clearSelection();
}

// Вернулись из выбора адреса с новым местом: обновить адрес и каталог, фильтры оставить.
export function onResume(container, result, ctx) {
  if (result?.placeId && result.placeId !== ctx.instance.placeId) {
    ctx.instance.placeId = result.placeId;
    ctx.router.setParams({ placeId: result.placeId });
    draw(container, ctx);
    container.scrollTop = 0;
  }
  ctx.map.focusPlace(ctx.instance.placeId);
}
