// home.js — главный экран в шторке (трек A, SPEC п.1–4, 17).
// Шапка шторки: поиск + чипсы категорий. Ниже — секции или результаты поиска.
import { LIST_CHUNK } from '../config.js';
import { chainRow, placeRow, anyRow, universalCard } from '../rows.js';
import { placeMatches } from '../search.js';

export const presentation = 'sheet';
export const sheetPosition = 'mid';

const VISIBLE_CHIPS = 6;
// Секции чековых офферов видны без фильтра и с «Супермаркетами» (docs/decisions-a.md).
const RECEIPT_CATEGORIES = [null, 'supermarkets'];

// --- Выборки для списка ------------------------------------------------------

// Места в области поиска с учётом категории и запроса, с расстоянием до пользователя.
function areaPlaces(ctx) {
  const { category, query, searchArea, location } = ctx.state.get();
  const q = ctx.format.normalize(query);
  return ctx.data.getPlaces({ categoryId: category || undefined, bounds: searchArea })
    .filter((p) => placeMatches(p, q))
    .map((place) => ({ place, distance: ctx.geo.distanceM(place, location) }))
    .sort((a, b) => a.distance - b.distance);
}

// Одна строка на сеть: ближайший магазин сети, где есть чековые акции.
function chainRows(items, ctx) {
  const best = new Map();
  items.forEach((it) => {
    const p = it.place;
    if (p.kind !== 'chain_store' || !ctx.data.getStoreCatalog(p).length) return;
    if (!best.has(p.chain_id)) best.set(p.chain_id, it); // items уже отсортированы по расстоянию
  });
  return [...best.values()];
}

// FuSe-бренд с несколькими точками — одной строкой (ближайшая точка), как и сеть.
function dedupeBrands(items) {
  const seen = new Set();
  return items.filter((it) => {
    const key = it.place.brand_id || it.place.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- Отрисовка ----------------------------------------------------------------

function headHTML(ctx) {
  const { ui, state } = ctx;
  return `
    <div class="home-head" data-sheet-drag>
      ${ui.searchField({ placeholder: 'Магазин, сеть или место', value: state.get('query') })}
      <div class="home-chips"></div>
    </div>
    <div class="home-body"></div>`;
}

function chipsHTML(ctx) {
  const { ui, data, state } = ctx;
  const all = data.getCategories().place;
  const active = state.get('category');
  let items = all.slice(0, VISIBLE_CHIPS);
  // Выбранная через «Ещё» категория — первым чипсом, чтобы было видно фильтр.
  if (active && !items.some((c) => c.id === active)) items = [all.find((c) => c.id === active), ...items];
  const more = `<button class="chip chip--more" type="button" data-more>Ещё ${ui.icon('chevron-down')}</button>`;
  return ui.chips(items.filter(Boolean), active, { extra: more });
}

function sectionHTML(title, body, extraClass = '') {
  return `<section class="section ${extraClass}"><div class="section__head"><h2 class="section__title">${title}</h2></div>${body}</section>`;
}

// Пустое состояние (SPEC п.4 и п.17): ничего не сбрасываем сами, предлагаем действия.
function emptyHTML(ctx) {
  const { ui, state, data } = ctx;
  const { query, category } = state.get();
  const actions = [{ label: 'Изменить область', action: 'area' }];
  if (category) actions.push({ label: 'Сбросить фильтры', action: 'reset-category' });
  if (query) actions.push({ label: 'Очистить поиск', action: 'clear-query' });
  const universal = data.getUniversalOffers();
  return ui.emptyState({
    title: query ? 'Ничего не нашли' : 'Рядом нет подходящих мест',
    text: query
      ? 'Попробуйте изменить запрос, фильтры или передвинуть карту и искать в другой области.'
      : 'Передвиньте карту и нажмите «Искать в этой области» или сбросьте фильтры.',
    actions,
  }) + (universal.length ? `<div class="home-universal">${universalCard(universal)}</div>` : '');
}

function renderBody(container, ctx) {
  const inst = ctx.instance;
  const body = container.querySelector('.home-body');
  const { query, category } = ctx.state.get();
  const items = areaPlaces(ctx);
  inst.observer?.disconnect();

  if (!items.length) {
    body.innerHTML = emptyHTML(ctx);
    return;
  }

  // Поиск: плоский список, сеть — одной строкой.
  if (query.trim()) {
    const chains = chainRows(items, ctx);
    const chainIds = new Set(chains.map((c) => c.place.chain_id));
    const flat = dedupeBrands(items.filter((it) => it.place.kind !== 'chain_store' || !chainIds.has(it.place.chain_id)));
    const rows = [...chains, ...flat].sort((a, b) => a.distance - b.distance);
    body.innerHTML = sectionHTML('Результаты', '<div class="home-list"></div>');
    mountChunked(body.querySelector('.home-list'), rows, (it) => anyRow(it.place, it.distance), container, ctx);
    return;
  }

  const showReceipts = RECEIPT_CATEGORIES.includes(category);
  const chains = showReceipts ? chainRows(items, ctx) : [];
  const universal = showReceipts ? ctx.data.getUniversalOffers() : [];
  const nearby = dedupeBrands(items.filter((it) => it.place.kind !== 'chain_store'));

  let html = '';
  if (chains.length) html += sectionHTML('Товары с кэшбэком', chains.map((it) => chainRow(it.place, it.distance)).join(''));
  if (universal.length) html += `<div class="home-universal">${universalCard(universal)}</div>`;
  if (nearby.length) html += sectionHTML('Места рядом', '<div class="home-list"></div>');
  if (!html) {
    body.innerHTML = emptyHTML(ctx);
    return;
  }
  body.innerHTML = html;
  const list = body.querySelector('.home-list');
  if (list) mountChunked(list, nearby, (it) => placeRow(it.place, it.distance), container, ctx);
}

// Рисуем порциями по LIST_CHUNK: следующая порция — когда пользователь доскроллил до конца.
function mountChunked(listEl, rows, rowHTML, container, ctx) {
  let shown = 0;
  const sentinel = document.createElement('div');
  sentinel.className = 'home-sentinel';
  const more = () => {
    const next = rows.slice(shown, shown + LIST_CHUNK);
    listEl.insertAdjacentHTML('beforeend', next.map(rowHTML).join(''));
    shown += next.length;
    if (shown >= rows.length) ctx.instance.observer?.disconnect();
    listEl.after(sentinel);
  };
  more();
  if (shown < rows.length) {
    ctx.instance.observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) more();
    }, { root: container, rootMargin: '400px' });
    ctx.instance.observer.observe(sentinel);
  }
}

function renderChips(container, ctx) {
  container.querySelector('.home-chips').innerHTML = chipsHTML(ctx);
}

// --- Экран --------------------------------------------------------------------

export function render(container, params, ctx) {
  const { state, router, sheet } = ctx;
  container.innerHTML = headHTML(ctx);
  renderChips(container, ctx);
  renderBody(container, ctx);

  const input = container.querySelector('.search__input');
  const clearBtn = container.querySelector('.search__clear');

  // Ввод поиска — с небольшой задержкой, чтобы не перерисовывать на каждую букву.
  let t = null;
  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value;
    clearTimeout(t);
    t = setTimeout(() => state.set({ query: input.value }), 150);
  });
  input.addEventListener('focus', () => { if (sheet.getPosition() !== 'full') sheet.setPosition('full'); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    state.set({ query: '' });
  });

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip-id]');
    if (chip) {
      const id = chip.dataset.chipId;
      state.set({ category: state.get('category') === id ? null : id });
      return;
    }
    if (e.target.closest('[data-more]')) { router.push('categories'); return; }
    if (e.target.closest('[data-open-universal]')) { router.push('universal'); return; }
    const row = e.target.closest('[data-place-id]');
    if (row) { router.push('store', { placeId: row.dataset.placeId, from: 'list' }); return; }
    const act = e.target.closest('[data-action]')?.dataset.action;
    if (act === 'area') sheet.setPosition('collapsed');
    if (act === 'reset-category') state.set({ category: null });
    if (act === 'clear-query') clearBtn.click();
  });

  // Фильтры и область → перерисовать список (шапку с поиском не трогаем, чтобы не терять фокус).
  ctx.instance.unsub = state.subscribe(['category', 'query', 'searchArea', 'location'], (s, changed) => {
    if (changed.includes('category')) renderChips(container, ctx);
    renderBody(container, ctx);
    if (!changed.includes('query')) container.scrollTop = 0;
  });
}

export function destroy(container, ctx) {
  ctx.instance.unsub?.();
  ctx.instance.observer?.disconnect();
}

// Вернулись на главный: если выбрали адрес в «Уточнить адрес» — переместить карту.
export function onResume(container, result, ctx) {
  if (result?.location) ctx.map.setLocation(result.location.latlng, result.location.name);
}
