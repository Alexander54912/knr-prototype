// map.js — Leaflet, кластеры, пины, режимы карты (трек A).
// API для экранов — docs/CONTRACTS.md, раздел 6. Экраны не трогают Leaflet напрямую.
/* global L */
import { MAP, SEARCH_RADIUS_M, USER_LOCATION } from './config.js';
import * as data from './data.js';
import { state } from './state.js';
import { sheet } from './sheet.js';
import { toast } from './ui.js';
import { boundsAround, distanceM, fromLeafletBounds, isInMoscow } from './geo.js';
import { filterPlaces } from './search.js';
import { clusterIcon, pinIcon, selectedPinIcon, userIcon } from './map-pins.js';
import * as mapUi from './map-ui.js';

let lmap = null;
let tiles = null;
let cluster = null;
let userMarker = null;
let selectedMarker = null;
let selectedId = null;

const markers = new Map();   // place.id → L.Marker (создаются один раз)
let shownIds = new Set();    // какие места сейчас прошли фильтр
let handlers = {};           // { onPlaceClick(place), onContextClose(), onAddressClick() }
let searchView = null;       // центр и зум карты в момент, когда задали область поиска
let filterTimer = null;
export const stats = { lastFilterMs: 0, shown: 0 };

// --- Маркеры и фильтр ------------------------------------------------------

function markerFor(place) {
  let m = markers.get(place.id);
  if (!m) {
    m = L.marker([place.lat, place.lng], { icon: pinIcon(place), keyboard: false });
    m.placeId = place.id;
    markers.set(place.id, m);
  }
  return m;
}

// Какие места показывать: режим карты важнее фильтров главного экрана.
function currentPlaces() {
  const { mapMode, category, query } = state.get();
  if (mapMode?.type === 'chain') return data.getPlaces({ chainId: mapMode.chainId });
  if (mapMode?.type === 'brand') return data.getPlaces({ brandId: mapMode.brandId });
  if (mapMode?.type === 'offer') return data.getOfferPlaces(data.getOffer(mapMode.offerId));
  return filterPlaces({ category, query });
}

function applyFilter() {
  const t0 = performance.now();
  const list = currentPlaces();
  shownIds = new Set(list.map((p) => p.id));
  if (selectedId && !shownIds.has(selectedId)) clearSelection();
  cluster.clearLayers();
  // Выбранное место рисуется отдельным маркером поверх кластеров.
  cluster.addLayers(list.filter((p) => p.id !== selectedId).map(markerFor));
  stats.lastFilterMs = Math.round(performance.now() - t0);
  stats.shown = list.length;
}

// --- Геометрия: видимая часть карты над шторкой ---------------------------

function headerBottom() {
  return document.querySelector('.app-header')?.offsetHeight || 0;
}

// Центр карты, при котором точка окажется посередине видимой полосы над шторкой.
function centerAboveSheet(latlng, zoom, pos = sheet.getPosition()) {
  const size = lmap.getSize();
  const top = headerBottom();
  const bottom = Math.min(sheet.topFor(pos), size.y);
  const targetY = bottom > top + 40 ? (top + bottom) / 2 : size.y / 2;
  const p = lmap.project(latlng, zoom).add([0, size.y / 2 - targetY]);
  return lmap.unproject(p, zoom);
}

// Показать ближайшие n мест вокруг точки целиком в видимой полосе.
function fitNearest(places, around, n = 8) {
  const near = places
    .map((p) => ({ p, d: distanceM(p, around) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(({ p }) => [p.lat, p.lng]);
  if (!near.length) return;
  const b = L.latLngBounds([...near, around]);
  lmap.fitBounds(b, {
    paddingTopLeft: [28, headerBottom() + 64],
    paddingBottomRight: [28, sheet.visibleHeight(sheet.getPosition()) + 28],
    maxZoom: 16,
  });
}

// --- Выбранный пин -----------------------------------------------------------

export function selectPlace(placeId) {
  if (selectedId === placeId) return;
  clearSelection();
  const place = data.getPlace(placeId);
  if (!place) return;
  selectedId = placeId;
  const base = markers.get(placeId);
  if (base && cluster.hasLayer(base)) cluster.removeLayer(base);
  selectedMarker = L.marker([place.lat, place.lng], { icon: selectedPinIcon(place), zIndexOffset: 1000, keyboard: false })
    .on('click', () => handlers.onPlaceClick?.(place))
    .addTo(lmap);
  state.set({ selectedPlaceId: placeId });
}

export function clearSelection() {
  if (!selectedId) return;
  const id = selectedId;
  selectedId = null;
  selectedMarker?.remove();
  selectedMarker = null;
  const base = markers.get(id);
  if (base && shownIds.has(id)) cluster.addLayer(base);
  state.set({ selectedPlaceId: null });
}

// Показать точку над шторкой и выделить её пин.
export function focusPlace(placeId, { select = true, animate = true } = {}) {
  const place = data.getPlace(placeId);
  if (!place || !lmap) return;
  if (select) selectPlace(placeId);
  const zoom = Math.max(lmap.getZoom(), MAP.focusZoom);
  lmap.setView(centerAboveSheet([place.lat, place.lng], zoom), zoom, { animate });
}

// --- Вид карты ------------------------------------------------------------

export function getView() {
  if (!lmap) return null;
  const c = lmap.getCenter();
  return { center: [c.lat, c.lng], zoom: lmap.getZoom() };
}

export function setView(view, { animate = false } = {}) {
  if (!lmap || !view) return;
  lmap.setView(view.center, view.zoom, { animate });
}

// --- Область поиска ---------------------------------------------------------

function rememberSearchView() {
  const c = lmap.getCenter();
  searchView = { center: [c.lat, c.lng], zoom: lmap.getZoom() };
  mapUi.setSearchAreaVisible(false);
}

// Область заметно ушла от той, по которой построен список?
function areaChanged() {
  if (!searchView) return false;
  const b = lmap.getBounds();
  const c = lmap.getCenter();
  const dy = Math.abs(c.lat - searchView.center[0]) / (b.getNorth() - b.getSouth());
  const dx = Math.abs(c.lng - searchView.center[1]) / (b.getEast() - b.getWest());
  return Math.max(dx, dy) > MAP.searchAreaShift || Math.abs(lmap.getZoom() - searchView.zoom) >= 1;
}

function updateSearchPill() {
  const onHome = document.documentElement.dataset.topScreen === 'home';
  mapUi.setSearchAreaVisible(onHome && !state.get('mapMode') && areaChanged());
}

function searchThisArea() {
  state.set({ searchArea: fromLeafletBounds(lmap.getBounds()) });
  rememberSearchView();
}

// --- Локация ----------------------------------------------------------------

// Переместить пользователя (реальная геолокация, демо или ручной адрес).
export function setLocation(latlng, label) {
  state.set({ location: latlng, locationLabel: label, searchArea: boundsAround(latlng, SEARCH_RADIUS_M) });
  userMarker.setLatLng(latlng);
  const zoom = MAP.startZoom;
  // Подписка до setView: при большом прыжке Leaflet шлёт moveend сразу, без анимации.
  lmap.once('moveend', rememberSearchView);
  lmap.setView(centerAboveSheet(latlng, zoom), zoom, { animate: true });
}

function locate() {
  const demo = () => {
    toast('Показываем демо-локацию в Москве');
    setLocation(USER_LOCATION, 'м. Белорусская');
  };
  if (!navigator.geolocation) { demo(); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (isInMoscow(ll)) setLocation(ll, 'Вы здесь');
      else demo();
    },
    demo,
    { timeout: 6000, maximumAge: 60000 },
  );
}

// --- Режимы карты (контекст) ------------------------------------------------

export function showChainOnly(chainId, { around } = {}) {
  const chain = data.getChain(chainId);
  clearSelection();
  state.set({ mapMode: { type: 'chain', chainId } });
  mapUi.setContext(`Только ${chain ? chain.name : 'эта сеть'}`);
  fitNearest(data.getPlaces({ chainId }), around || state.get('location'));
}

// То же для FuSe-бренда («Выбрать другой адрес» у сети кофеен и т.п.).
export function showBrandOnly(brandId, { around } = {}) {
  const brand = data.getBrand(brandId);
  clearSelection();
  state.set({ mapMode: { type: 'brand', brandId } });
  mapUi.setContext(`Только ${brand ? brand.name : 'этот бренд'}`);
  fitNearest(data.getPlaces({ brandId }), around || state.get('location'));
}

export function showOfferContext(offerId) {
  const offer = data.getOffer(offerId);
  clearSelection();
  state.set({ mapMode: { type: 'offer', offerId } });
  mapUi.setContext(`Где купить: ${offer ? offer.short_title : 'акция'}`);
  fitNearest(data.getOfferPlaces(offer), state.get('location'));
}

export function clearContext() {
  if (!state.get('mapMode')) return;
  clearSelection();
  state.set({ mapMode: null });
  mapUi.setContext(null);
}

// --- Запуск -------------------------------------------------------------------

export function setHandlers(h) {
  handlers = { ...handlers, ...h };
}

export function init(el) {
  lmap = L.map(el, {
    zoomControl: false,
    minZoom: MAP.minZoom,
    maxZoom: MAP.maxZoom,
    inertia: true,
  });
  lmap.attributionControl.setPrefix(false).setPosition('topright');

  tiles = L.tileLayer(MAP.tiles.url, {
    subdomains: MAP.tiles.subdomains,
    maxNativeZoom: MAP.tiles.maxNativeZoom,
    maxZoom: MAP.maxZoom,
    attribution: MAP.attribution,
  }).addTo(lmap);
  // Тема подложки — CSS-фильтром по атрибуту (тёмная — инверсия светлых тайлов).
  el.dataset.tiles = state.get('theme');

  cluster = L.markerClusterGroup({
    chunkedLoading: true,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    removeOutsideVisibleBounds: true,
    // Радиус кластера по зуму: издалека — крупные кластеры, на уровне улиц — почти все пины по отдельности.
    maxClusterRadius: (z) => MAP.clusterRadiusByZoom.find(([minZ]) => z >= minZ)[1],
    iconCreateFunction: clusterIcon,
  });
  // Один обработчик на всю группу, а не на каждый маркер.
  cluster.on('click', (e) => {
    const place = data.getPlace(e.layer.placeId);
    if (place) handlers.onPlaceClick?.(place);
  });
  lmap.addLayer(cluster);

  const loc = state.get('location');
  userMarker = L.marker(loc, { icon: userIcon(), interactive: false, keyboard: false, zIndexOffset: 500 }).addTo(lmap);
  lmap.setView(centerAboveSheet(loc, MAP.startZoom), MAP.startZoom);
  rememberSearchView();
  applyFilter();

  mapUi.init(document.getElementById('map-ui'), {
    'search-area': searchThisArea,
    'context-close': () => handlers.onContextClose?.(),
    'zoom-in': () => lmap.zoomIn(),
    'zoom-out': () => lmap.zoomOut(),
    locate,
    address: () => handlers.onAddressClick?.(),
  });

  lmap.on('moveend', updateSearchPill);
  lmap.on('click', () => {
    if (document.documentElement.dataset.topScreen === 'home') clearSelection();
  });
  window.addEventListener('router:change', updateSearchPill);

  // Фильтры главного экрана и режим карты → пины. Поиск — с задержкой, чтобы не дёргать карту на каждую букву.
  state.subscribe(['category', 'mapMode'], applyFilter);
  state.subscribe(['query'], () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(applyFilter, 200);
  });
  state.subscribe(['theme'], (s) => { el.dataset.tiles = s.theme; });
}

export function leaflet() {
  return lmap;
}

export const map = {
  init, setHandlers, showOfferContext, showChainOnly, showBrandOnly, clearContext,
  focusPlace, selectPlace, clearSelection, getView, setView, setLocation, stats, leaflet,
};
