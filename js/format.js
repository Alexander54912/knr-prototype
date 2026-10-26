// format.js — тексты выгоды, даты, рубли, расстояния.
// Владелец — трек B. Начальная версия написана треком A на этапе 0 по docs/CONTRACTS.md.

const NBSP = ' ';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

// Склонение: plural(5, ['акция', 'акции', 'акций']) → 'акций'.
export function plural(n, [one, few, many]) {
  const n10 = Math.abs(n) % 10;
  const n100 = Math.abs(n) % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

// Число с неразрывными пробелами между тысячами: 12500 → '12 500'.
function groupThousands(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

// Обычный оффер: «Кэшбэк 20%» / «Скидка 30%».
export function formatBenefit(regularOffer) {
  if (!regularOffer) return '';
  const word = regularOffer.type === 'discount' ? 'Скидка' : 'Кэшбэк';
  return `${word} ${regularOffer.value}%`;
}

// Чековый оффер: «90%» или «до 10%», если ставка зависит от суммы в чеке.
export function formatRate(offer) {
  if (!offer) return '';
  if (offer.mechanic === 'tiers_in_receipt' && offer.tiers && offer.tiers.length) {
    const max = Math.max(...offer.tiers.map((t) => t.rate));
    return `до ${max}%`;
  }
  return `${offer.rate}%`;
}

// Дата через N дней от сегодня: '18 ноября'.
export function formatDate(daysFromToday) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Срок: «До 18 ноября», «Остался 1 день», «Последний день», «Акция закончилась».
export function formatDeadline(offer) {
  if (!offer) return '';
  const d = offer.ends_in_days;
  if (offer.status === 'expired' || d < 0) return 'Акция закончилась';
  if (d === 0) return 'Последний день';
  if (d === 1) return 'Остался 1 день';
  return `До ${formatDate(d)}`;
}

// Расстояние: '350 м', '1,2 км', '12 км'.
export function formatDistance(m) {
  if (m == null || Number.isNaN(m)) return '';
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)}${NBSP}м`;
  if (m < 10000) return `${(m / 1000).toFixed(1).replace('.', ',')}${NBSP}км`;
  return `${Math.round(m / 1000)}${NBSP}км`;
}

// Время пешком: '5 мин' (80 м/мин, минимум 1).
export function formatWalk(m) {
  return `${Math.max(1, Math.round(m / 80))}${NBSP}мин`;
}

// Рубли: '500 ₽', '1 000 ₽'.
export function formatRub(n) {
  return `${groupThousands(n)}${NBSP}₽`;
}

// Бонусы: '600 бонусов'.
export function formatBonus(n) {
  return `${groupThousands(n)}${NBSP}${plural(n, ['бонус', 'бонуса', 'бонусов'])}`;
}

// Нормализация для поиска: нижний регистр, ё → е, без кавычек, схлопнутые пробелы.
export function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"„“”'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Экранирование для вставки в innerHTML.
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
