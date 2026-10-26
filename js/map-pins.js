// map-pins.js — HTML и иконки Leaflet для пинов, выбранного пина, кластеров и маркера «я здесь».
/* global L */
import * as data from './data.js';
import { escapeHtml, formatBenefit, plural } from './format.js';
import { logo } from './ui.js';

const PIN = 34;      // компактный пин, px
const SEL = 48;      // выбранный пин, px
const TAIL = 9;      // «хвостик» выбранного пина

// Короткая выгода места для подписи: «Кэшбэк 20%», «12 акций по чеку», «Кэшбэк 7% · 9 по чеку».
export function benefitShort(place) {
  const regular = data.getRegularOffer(place);
  const n = data.getStoreCatalog(place).length;
  const reg = regular ? formatBenefit(regular) : '';
  if (reg && n) return `${reg} · ${n} по чеку`;
  if (n) return `${n} ${plural(n, ['акция', 'акции', 'акций'])} по чеку`;
  return reg;
}

// Компактный пин: логотип сети/бренда или иконка категории, без подписи.
export function pinIcon(place) {
  return L.divIcon({
    className: 'pin',
    html: `<span class="pin__dot">${logo(data.getPlaceVisual(place), 's')}</span>`,
    iconSize: [PIN, PIN],
    iconAnchor: [PIN / 2, PIN / 2],
  });
}

// Выбранный пин: крупнее, с хвостиком и плашкой «название + выгода».
export function selectedPinIcon(place) {
  const label = `
    <span class="pin-sel__label">
      <span class="pin-sel__name">${escapeHtml(place.name)}</span>
      <span class="pin-sel__benefit">${escapeHtml(benefitShort(place))}</span>
    </span>`;
  return L.divIcon({
    className: 'pin-sel',
    html: `<span class="pin-sel__dot">${logo(data.getPlaceVisual(place), 'm')}</span><span class="pin-sel__tail"></span>${label}`,
    iconSize: [SEL, SEL + TAIL],
    iconAnchor: [SEL / 2, SEL + TAIL],
  });
}

// Кластер: синий круг с числом физических мест, растёт с числом.
export function clusterIcon(cluster) {
  const n = cluster.getChildCount();
  const size = n < 10 ? 's' : n < 100 ? 'm' : 'l';
  const d = { s: 36, m: 44, l: 52 }[size];
  return L.divIcon({
    className: `cluster cluster--${size}`,
    html: `<span>${n > 99 ? '99+' : n}</span>`,
    iconSize: [d, d],
  });
}

// Маркер «я здесь».
export function userIcon() {
  return L.divIcon({
    className: 'user-dot',
    html: '<span class="user-dot__pulse"></span><span class="user-dot__core"></span>',
    iconSize: [22, 22],
  });
}
