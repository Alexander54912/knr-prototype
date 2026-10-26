// state.js — единое состояние прототипа и простые подписки.
// Читать: state.get() / state.get('category'). Менять: state.set({ category: 'food' }).
import { STORAGE_KEY, USER_LOCATION } from './config.js';

// Поля, которые переживают перезагрузку страницы (localStorage).
const PERSISTED = ['favorites', 'activated'];

const data = {
  category: null,        // id категории мест или null
  query: '',             // строка поиска на главном экране
  searchArea: null,      // { south, west, north, east } — область, по которой строится список
  location: USER_LOCATION, // [lat, lng] — где пользователь (реальная или демо)
  locationLabel: 'м. Белорусская',
  sheetPos: 'mid',       // 'collapsed' | 'mid' | 'full'
  mapMode: null,         // null | { type: 'chain', chainId } | { type: 'offer', offerId }
  selectedPlaceId: null, // выбранный пин
  favorites: [],         // id чековых офферов в избранном
  activated: [],         // id активированных офферов
  dev: { receiptError: false },
  theme: 'dark',
};

const subscribers = new Set();

// Прочитать сохранённое из localStorage (без него всё тоже работает).
function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    PERSISTED.forEach((k) => {
      if (Array.isArray(saved[k])) data[k] = saved[k];
    });
  } catch (e) {
    // приватный режим или битые данные — молча работаем без сохранения
  }
}

function savePersisted() {
  try {
    const out = {};
    PERSISTED.forEach((k) => { out[k] = data[k]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch (e) {
    // нет доступа к localStorage — не страшно
  }
}

export function get(key) {
  return key ? data[key] : data;
}

// Изменить поля и оповестить подписчиков, которым это интересно.
export function set(patch) {
  const changed = [];
  Object.keys(patch).forEach((k) => {
    if (data[k] !== patch[k]) {
      data[k] = patch[k];
      changed.push(k);
    }
  });
  if (!changed.length) return;
  if (changed.some((k) => PERSISTED.includes(k))) savePersisted();
  subscribers.forEach((sub) => {
    if (!sub.keys || sub.keys.some((k) => changed.includes(k))) {
      try {
        sub.fn(data, changed);
      } catch (err) {
        console.error('[state] ошибка в подписчике', err);
      }
    }
  });
}

// Подписаться на изменения полей (keys = null — на все). Возвращает функцию отписки.
export function subscribe(keys, fn) {
  const sub = { keys: keys ? [].concat(keys) : null, fn };
  subscribers.add(sub);
  return () => subscribers.delete(sub);
}

// Удобные помощники для избранного и активаций.
export function toggleInList(key, id) {
  const list = data[key];
  set({ [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
}

export function resetStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* нет доступа */ }
  set({ favorites: [], activated: [] });
}

loadPersisted();

// Объект для ctx.state.
export const state = { get, set, subscribe, toggleInList, resetStorage };
