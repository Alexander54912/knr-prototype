// geo.js — расстояния, время пешком, попадание в область.
import { MOSCOW_CENTER, MOSCOW_RADIUS_M, WALK_M_PER_MIN } from './config.js';

// Принимаем и [lat, lng], и объекты с полями lat/lng (места из places.json, L.LatLng).
function toLL(x) {
  return Array.isArray(x) ? x : [x.lat, x.lng];
}

// Расстояние между двумя точками в метрах (формула гаверсинусов).
export function distanceM(a, b) {
  const [lat1, lng1] = toLL(a);
  const [lat2, lng2] = toLL(b);
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Минуты пешком, минимум 1.
export function walkMinutes(m) {
  return Math.max(1, Math.round(m / WALK_M_PER_MIN));
}

// Точка внутри области { south, west, north, east }?
export function inBounds(x, b) {
  const [lat, lng] = toLL(x);
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

// Квадратная область вокруг точки с «радиусом» в метрах.
export function boundsAround(x, radiusM) {
  const [lat, lng] = toLL(x);
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
  return { south: lat - dLat, west: lng - dLng, north: lat + dLat, east: lng + dLng };
}

// Leaflet LatLngBounds → { south, west, north, east }.
export function fromLeafletBounds(lb) {
  return { south: lb.getSouth(), west: lb.getWest(), north: lb.getNorth(), east: lb.getEast() };
}

// Насколько сильно отличаются две области: сдвиг центра или изменение размера
// в долях от размера старой области (0 — совпадают).
export function boundsShift(a, b) {
  const h = a.north - a.south;
  const w = a.east - a.west;
  const dc = Math.max(
    Math.abs((a.north + a.south) / 2 - (b.north + b.south) / 2) / h,
    Math.abs((a.east + a.west) / 2 - (b.east + b.west) / 2) / w,
  );
  const ds = Math.abs((b.north - b.south) / h - 1);
  return Math.max(dc, ds);
}

// Центр области.
export function boundsCenter(b) {
  return [(b.north + b.south) / 2, (b.east + b.west) / 2];
}

// Пользователь в Москве?
export function isInMoscow(x) {
  return distanceM(x, MOSCOW_CENTER) <= MOSCOW_RADIUS_M;
}
