// data.js — загрузка JSON, индексы и функции выборки.
// Владелец — трек B. Начальная версия написана треком A на этапе 0 по docs/CONTRACTS.md (раздел 2).
import { distanceM, inBounds } from './geo.js';

const FILES = ['places', 'chains', 'brands', 'offers_regular', 'offers_receipt', 'categories'];

// Сырые данные.
let places = [];
let chains = [];
let brands = [];
let regularOffers = [];
let receiptOffers = [];
let categories = { place: [], product: [] };

// Индексы по id.
const byId = {
  place: new Map(),
  chain: new Map(),
  brand: new Map(),
  regular: new Map(),
  offer: new Map(),
  category: new Map(),
};

// Офферы, сгруппированные для быстрого расчёта каталога.
const chainOffers = new Map();   // chain_id → активные сетевые офферы
let confirmedUniversal = [];      // активные универсальные с store_match_confirmed

// Кэши (данные не меняются после загрузки).
const catalogCache = new Map();     // place.id → offers[]
const offerPlacesCache = new Map(); // offer.id → places[]

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Не удалось загрузить ${url}: ${res.status}`);
  return res.json();
}

async function loadFrom(base) {
  const all = await Promise.all(FILES.map((f) => fetchJson(`${base}${f}.json`)));
  return Object.fromEntries(FILES.map((f, i) => [f, all[i]]));
}

// Загрузить данные: полные из data/, иначе пробные из data/sample/.
export async function loadData() {
  // Сначала проверяем один файл, чтобы в режиме sample была одна 404, а не шесть.
  let source = 'full';
  try {
    const probe = await fetch('data/places.json', { method: 'HEAD', cache: 'no-cache' });
    if (!probe.ok) source = 'sample';
  } catch (err) {
    source = 'sample';
  }
  if (source === 'sample') console.info('[data] полные данные не найдены, грузим data/sample/');
  const raw = await loadFrom(source === 'full' ? 'data/' : 'data/sample/');
  places = raw.places;
  chains = raw.chains;
  brands = raw.brands;
  regularOffers = raw.offers_regular;
  receiptOffers = raw.offers_receipt;
  categories = {
    place: [...raw.categories.place].sort((a, b) => a.order - b.order),
    product: [...raw.categories.product].sort((a, b) => a.order - b.order),
  };
  buildIndexes();
  return { source };
}

function buildIndexes() {
  Object.values(byId).forEach((m) => m.clear());
  chainOffers.clear();
  catalogCache.clear();
  offerPlacesCache.clear();

  places.forEach((p) => byId.place.set(p.id, p));
  chains.forEach((c) => byId.chain.set(c.id, c));
  brands.forEach((b) => byId.brand.set(b.id, b));
  regularOffers.forEach((o) => byId.regular.set(o.id, o));
  receiptOffers.forEach((o) => byId.offer.set(o.id, o));
  categories.place.forEach((c) => byId.category.set(c.id, c));
  categories.product.forEach((c) => byId.category.set(c.id, c));

  const active = receiptOffers.filter((o) => o.status !== 'expired');
  active.filter((o) => o.where.type === 'chain').forEach((o) => {
    o.where.chain_ids.forEach((cid) => {
      if (!chainOffers.has(cid)) chainOffers.set(cid, []);
      chainOffers.get(cid).push(o);
    });
  });
  confirmedUniversal = active.filter((o) => o.where.type === 'any' && o.store_match_confirmed);
}

// Формат магазина подходит под условия оффера?
function formatOk(offer, place) {
  const f = offer.where.formats;
  return !f || f.length === 0 || f.includes(place.format);
}

// --- Выборки -------------------------------------------------------------

// Места с фильтром { categoryId, kind, chainId, brandId, bounds }.
export function getPlaces(filter = {}) {
  const { categoryId, kind, chainId, brandId, bounds } = filter;
  if (!categoryId && !kind && !chainId && !brandId && !bounds) return places;
  return places.filter((p) =>
    (!categoryId || p.category_id === categoryId) &&
    (!kind || p.kind === kind) &&
    (!chainId || p.chain_id === chainId) &&
    (!brandId || p.brand_id === brandId) &&
    (!bounds || inBounds(p, bounds)));
}

export const getPlace = (id) => byId.place.get(id) || null;
export const getChain = (id) => byId.chain.get(id) || null;
export const getBrand = (id) => byId.brand.get(id) || null;
export const getChains = () => chains;
export const getCategories = () => categories;
export const getCategory = (id) => byId.category.get(id) || null;
export const getOffer = (id) => byId.offer.get(id) || null;

// Каталог чековых офферов магазина. Единственный источник числа «N акций по чеку».
export function getStoreCatalog(place) {
  if (!place || place.kind !== 'chain_store') return [];
  if (catalogCache.has(place.id)) return catalogCache.get(place.id);

  const seen = new Set();
  const result = [];
  const add = (o) => {
    if (seen.has(o.id)) return;
    seen.add(o.id);
    result.push(o);
  };
  // 1. Сетевые: сеть магазина в списке и формат подходит.
  (chainOffers.get(place.chain_id) || []).forEach((o) => {
    if (formatOk(o, place)) add(o);
  });
  // 2. Универсальные с подтверждённым соответствием: формат подходит, сеть не в исключениях.
  confirmedUniversal.forEach((o) => {
    if (formatOk(o, place) && !(o.where.excluded || []).includes(place.chain_id)) add(o);
  });
  // Истёкшие отброшены заранее (chainOffers и confirmedUniversal — только активные).
  result.sort((a, b) => b.rate - a.rate || a.id.localeCompare(b.id));
  catalogCache.set(place.id, result);
  return result;
}

// Активные универсальные офферы («В любых магазинах»).
export function getUniversalOffers() {
  return receiptOffers.filter((o) => o.status !== 'expired' && o.where.type === 'any');
}

export function getExpiredOffers() {
  return receiptOffers.filter((o) => o.status === 'expired');
}

// Все места, в каталоге которых есть оффер (для «Показать на карте»).
export function getOfferPlaces(offer) {
  if (!offer) return [];
  if (offerPlacesCache.has(offer.id)) return offerPlacesCache.get(offer.id);
  let result = [];
  const unconfirmed = offer.where.type === 'any' && !offer.store_match_confirmed;
  if (offer.status !== 'expired' && !unconfirmed) {
    result = places.filter((p) => p.kind === 'chain_store' && getStoreCatalog(p).includes(offer));
  }
  offerPlacesCache.set(offer.id, result);
  return result;
}

// Отсортировать места по расстоянию от точки.
function nearest(list, latlng, limit) {
  return list
    .map((place) => ({ place, distance: distanceM(place, latlng) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit ?? list.length);
}

// Магазины сети по возрастанию расстояния.
export function getChainStoresNear(chainId, latlng, limit) {
  return nearest(getPlaces({ chainId }), latlng, limit);
}

// «Другие адреса» этого же места: сеть, FuSe-бренд или само место (SeSe).
export function getSiblingsNear(place, latlng, limit) {
  if (place.chain_id) return getChainStoresNear(place.chain_id, latlng, limit);
  if (place.brand_id) return nearest(getPlaces({ brandId: place.brand_id }), latlng, limit);
  return nearest([place], latlng, 1);
}

export function getRegularOffer(place) {
  return (place && place.regular_offer_id && byId.regular.get(place.regular_offer_id)) || null;
}

// Первые буквы для логотипа-заглушки: из названия в кавычках или первого слова.
function initials(name) {
  const quoted = /[«"„]([^»"“]+)[»"“]/.exec(name);
  const word = (quoted ? quoted[1] : name).trim();
  return word.charAt(0).toUpperCase();
}

// Чем рисовать логотип и пин места.
export function getPlaceVisual(place) {
  const owner = (place.chain_id && getChain(place.chain_id)) || (place.brand_id && getBrand(place.brand_id)) || null;
  const cat = getCategory(place.category_id);
  return {
    logo: owner?.logo ?? null,
    letters: owner?.letters ?? initials(place.name),
    color: owner?.color ?? cat?.color ?? '#8A8A8E',
    textColor: owner?.text_color ?? '#FFFFFF',
    icon: owner ? null : (cat?.icon ?? null),
  };
}
