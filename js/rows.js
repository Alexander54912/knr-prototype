// rows.js — строки списков (главный экран, результаты поиска, режим карты, выбор адреса).
// Возвращают HTML. Нажатие обрабатывает экран по data-place-id.
import * as data from './data.js';
import { escapeHtml, formatBenefit, formatDeadline, formatDistance, formatRate, formatWalk, plural } from './format.js';
import { icon, logo, productImage } from './ui.js';

// «ул. Лесная, 12 · 350 м · 5 мин»
export function addressLine(place, distance) {
  const parts = [place.address];
  if (distance != null) parts.push(formatDistance(distance), formatWalk(distance));
  return parts.map(escapeHtml).join(' · ');
}

// «N акций по чеку» для магазина — только через getStoreCatalog.
export function receiptCountText(place) {
  const n = data.getStoreCatalog(place).length;
  return n ? `${n} ${plural(n, ['акция', 'акции', 'акций'])}` : '';
}

// Максимальная ставка каталога: «до 90%».
function maxRateText(catalog) {
  if (!catalog.length) return '';
  const best = catalog.reduce((a, b) => (b.rate > a.rate ? b : a));
  const rate = formatRate(best).replace(/^до /, '');
  return catalog.length > 1 || best.mechanic === 'tiers_in_receipt' ? `до ${rate}` : rate;
}

// Строка сети: логотип, название, адрес ближайшего магазина, расстояние, «N акций по чеку».
// Если у магазина есть ещё и обычный оффер (ВкусВилл) — обе выгоды в одной строке.
export function chainRow(place, distance) {
  const chain = data.getChain(place.chain_id);
  const catalog = data.getStoreCatalog(place);
  const regular = data.getRegularOffer(place);
  const thumbs = catalog.slice(0, 3).map((o) => productImage(o, 's')).join('');
  return `
    <button class="row row--chain" type="button" data-place-id="${escapeHtml(place.id)}">
      <span class="row__logo">${logo(data.getPlaceVisual(place), 'l')}</span>
      <span class="row__body">
        <span class="row__head">
          <span class="row__title">${escapeHtml(chain ? chain.name : place.name)}</span>
          <span class="row__value">${escapeHtml(maxRateText(catalog))}</span>
        </span>
        <span class="row__sub row__benefit"><span class="tag-receipt">По чеку</span> ${escapeHtml(receiptCountText(place))}</span>
        ${regular ? `<span class="row__sub row__benefit row__benefit--regular">${escapeHtml(formatBenefit(regular))} · ${escapeHtml(regular.condition.toLowerCase())}</span>` : ''}
        <span class="row__meta">${addressLine(place, distance)}</span>
        ${thumbs ? `<span class="row__thumbs">${thumbs}</span>` : ''}
      </span>
    </button>`;
}

// Строка места FuSe/SeSe: выгода, условие, срок, подкатегория.
export function placeRow(place, distance) {
  const regular = data.getRegularOffer(place);
  return `
    <button class="row" type="button" data-place-id="${escapeHtml(place.id)}">
      <span class="row__logo">${logo(data.getPlaceVisual(place), 'l')}</span>
      <span class="row__body">
        <span class="row__head">
          <span class="row__title">${escapeHtml(place.name)}</span>
          <span class="row__value">${regular ? escapeHtml(formatBenefit(regular)) : ''}</span>
        </span>
        ${regular ? `<span class="row__sub">${escapeHtml(regular.condition)}</span>` : ''}
        ${regular ? `<span class="row__sub">${escapeHtml(formatDeadline(regular))}</span>` : ''}
        <span class="row__meta">${escapeHtml(place.subcategory || '')}${distance != null ? ` · ${escapeHtml(formatDistance(distance))}` : ''}</span>
      </span>
    </button>`;
}

// Любое место: магазин сети — строкой сети, остальное — строкой места.
export function anyRow(place, distance) {
  return place.kind === 'chain_store' ? chainRow(place, distance) : placeRow(place, distance);
}

// Карточка-вход «В любых магазинах»: 3 превью товаров и число акций.
export function universalCard(offers) {
  const previews = [...offers].sort((a, b) => b.rate - a.rate).slice(0, 3);
  return `
    <button class="universal-entry" type="button" data-open-universal>
      <span class="universal-entry__thumbs">${previews.map((o) => productImage(o, 's')).join('')}</span>
      <span class="universal-entry__body">
        <span class="universal-entry__title">В любых магазинах</span>
        <span class="universal-entry__sub"><span class="tag-receipt">По чеку</span> ${offers.length} ${plural(offers.length, ['акция', 'акции', 'акций'])} без привязки к сети</span>
      </span>
      ${icon('chevron-right', 'universal-entry__chevron')}
    </button>`;
}
