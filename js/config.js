// config.js — все настройки прототипа в одном месте.

// Демо-локация пользователя: рядом с метро «Белорусская».
export const USER_LOCATION = [55.7700, 37.5950];

// Центр Москвы и радиус, в котором считаем, что пользователь «в Москве».
export const MOSCOW_CENTER = [55.7558, 37.6173];
export const MOSCOW_RADIUS_M = 25000;

// Демо-адреса для «Уточнить адрес» и dev-панели.
export const DEMO_LOCATIONS = [
  { id: 'belorusskaya', name: 'м. Белорусская', address: 'ул. Лесная, 20', latlng: [55.7700, 37.5950] },
  { id: 'kurskaya', name: 'м. Курская', address: 'ул. Земляной Вал, 33', latlng: [55.7577, 37.6590] },
  { id: 'universitet', name: 'м. Университет', address: 'Ломоносовский пр-т, 25', latlng: [55.6923, 37.5345] },
  { id: 'sokol', name: 'м. Сокол', address: 'Ленинградский пр-т, 74', latlng: [55.8055, 37.5150] },
  { id: 'tulskaya', name: 'м. Тульская', address: 'Большая Тульская ул., 13', latlng: [55.7088, 37.6223] },
  { id: 'izmaylovo', name: 'м. Измайловская', address: 'Измайловский пр-т, 63', latlng: [55.7877, 37.7799] },
];

// Карта.
export const MAP = {
  startZoom: 15,
  minZoom: 10,
  maxZoom: 19,
  focusZoom: 16,          // зум при выборе места
  // Радиус кластеризации, px: [с какого зума, радиус] — от больших зумов к меньшим.
  clusterRadiusByZoom: [[17, 24], [16, 30], [15, 40], [14, 50], [0, 60]],
  // Подложка. CARTO без ключа теперь отдаёт заглушку «API KEY REQUIRED» на всех зумах,
  // поэтому берём стандартные тайлы OpenStreetMap, а тёмную тему делаем CSS-фильтром (css/map.css).
  // Подробности — docs/decisions-a.md.
  tiles: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: '',
    maxNativeZoom: 19,
  },
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">участники OpenStreetMap</a>',
  // На сколько должна сдвинуться область, чтобы показать «Искать в этой области» (доля от размера области).
  searchAreaShift: 0.25,
};

// Область поиска по умолчанию — радиус вокруг локации.
export const SEARCH_RADIUS_M = 1500;

// Шторка: высоты положений.
export const SHEET = {
  collapsedPx: 120,       // видны ручка и строка поиска
  midRatio: 0.66,         // доля высоты экрана
  durationMs: 280,
  velocityThreshold: 0.5, // px/мс — быстрый жест перекидывает в следующее положение
};

// Сколько строк «Места рядом» рисовать за раз.
export const LIST_CHUNK = 30;

// Сколько ближайших адресов показывать в «Выбрать другой адрес».
export const ADDRESS_PICKER_LIMIT = 20;

// Скорость пешехода для «N мин пешком».
export const WALK_M_PER_MIN = 80;

// Ключ localStorage.
export const STORAGE_KEY = 'knr-prototype-v1';
