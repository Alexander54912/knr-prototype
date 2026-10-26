// store-catalog.js — каталог чековых акций внутри карточки магазина (SPEC п.9, 17).
// Локальные фильтры (поиск и товарная категория) живут в state и не трогают главный экран.

// Текст для поиска по акции: название, бренд, товары и варианты.
function haystack(offer, normalize) {
  const items = (offer.items || []).map((i) => `${i.name} ${i.variant || ''}`).join(' ');
  return normalize(`${offer.short_title} ${offer.title} ${offer.brand} ${items}`);
}

// Акции после фильтров; выбранная («Показать на карте») — первой.
function visibleOffers(catalog, filters, highlightId, normalize) {
  const q = normalize(filters.query);
  let list = catalog.filter((o) =>
    (!filters.category || o.product_category_id === filters.category) &&
    (!q || q.split(' ').every((w) => haystack(o, normalize).includes(w))));
  if (highlightId) {
    const i = list.findIndex((o) => o.id === highlightId);
    if (i > 0) list = [list[i], ...list.slice(0, i), ...list.slice(i + 1)];
  }
  return list;
}

// Чипсы только тех товарных категорий, где есть акции (+ выбранная, даже если в новом адресе её нет).
function chipItems(catalog, active, data) {
  const present = new Set(catalog.map((o) => o.product_category_id));
  if (active) present.add(active);
  const cats = data.getCategories().product.filter((c) => present.has(c.id));
  return [{ id: '__all', name: 'Все' }, ...cats];
}

// Каркас каталога (рисуется один раз; потом обновляются только чипсы и сетка).
export function catalogHTML(catalog, filters, ctx) {
  const { ui, format } = ctx;
  const n = catalog.length;
  return `
    <section class="section store-catalog">
      <div class="section__head">
        <h2 class="section__title">Товары с кэшбэком</h2>
        <span class="store-catalog__count"><span class="tag-receipt">По чеку</span> ${n} ${format.plural(n, ['акция', 'акции', 'акций'])}</span>
      </div>
      ${ui.searchField({ placeholder: 'Товар или бренд', value: filters.query })}
      <div class="store-catalog__chips"></div>
      <div class="store-catalog__grid"></div>
      <div class="disclaimer">${ui.icon('info')}<span>Наличие товаров уточняйте в магазине. Акция не гарантирует, что товар есть на полке.</span></div>
    </section>`;
}

// Обновить чипсы и сетку под текущие фильтры.
export function updateCatalog(root, catalog, filters, highlightId, ctx) {
  const { ui, data, format } = ctx;
  root.querySelector('.store-catalog__chips').innerHTML = ui.chips(chipItems(catalog, filters.category, data), filters.category || '__all');
  const list = visibleOffers(catalog, filters, highlightId, format.normalize);
  const grid = root.querySelector('.store-catalog__grid');
  if (!list.length) {
    grid.innerHTML = ui.emptyState({
      title: filters.query ? 'Ничего не нашли' : 'В этой категории нет акций',
      text: 'В этом магазине есть другие акции по чеку.',
      actions: [{ label: 'Сбросить фильтр', action: 'reset-catalog' }],
    });
    return;
  }
  grid.innerHTML = `<div class="product-grid">${list.map((o) => ui.productCard(o)).join('')}</div>`;
  if (highlightId) grid.querySelector(`[data-offer-id="${highlightId}"]`)?.classList.add('is-highlighted');
}

// Подключить обработчики каталога; filters — объект, который меняется на месте.
export function bindCatalog(root, getCatalog, filters, getHighlight, ctx) {
  const input = root.querySelector('.store-catalog .search__input');
  const clearBtn = root.querySelector('.store-catalog .search__clear');
  const redraw = () => updateCatalog(root, getCatalog(), filters, getHighlight(), ctx);
  let t = null;
  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value;
    clearTimeout(t);
    t = setTimeout(() => { filters.query = input.value; redraw(); }, 120);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    filters.query = '';
    redraw();
  });
  root.querySelector('.store-catalog').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip-id]');
    if (chip) {
      filters.category = chip.dataset.chipId === '__all' ? null : chip.dataset.chipId;
      redraw();
      return;
    }
    if (e.target.closest('[data-action="reset-catalog"]')) {
      filters.category = null;
      filters.query = '';
      input.value = '';
      clearBtn.hidden = true;
      redraw();
    }
  });
  return redraw;
}
