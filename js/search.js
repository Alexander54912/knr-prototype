// search.js — поиск мест по названию, сети, бренду, подкатегории и адресу.
// Одно правило и для списка на главном, и для пинов на карте.
import * as data from './data.js';
import { normalize } from './format.js';

const haystacks = new Map(); // place.id → нормализованная строка для поиска

function haystack(place) {
  let h = haystacks.get(place.id);
  if (h) return h;
  const chain = place.chain_id ? data.getChain(place.chain_id) : null;
  const brand = place.brand_id ? data.getBrand(place.brand_id) : null;
  const cat = data.getCategory(place.category_id);
  h = normalize([place.name, chain?.name, brand?.name, place.subcategory, cat?.name, place.address, place.district].filter(Boolean).join(' '));
  haystacks.set(place.id, h);
  return h;
}

// q — уже нормализованный запрос (format.normalize). Все слова запроса должны найтись.
export function placeMatches(place, q) {
  if (!q) return true;
  const h = haystack(place);
  return q.split(' ').every((w) => h.includes(w));
}

// Места для текущих фильтров главного экрана: категория + поиск.
export function filterPlaces({ category, query }) {
  const q = normalize(query);
  let list = data.getPlaces(category ? { categoryId: category } : {});
  if (q) list = list.filter((p) => placeMatches(p, q));
  return list;
}
