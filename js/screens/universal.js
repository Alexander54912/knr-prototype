// universal.js — «В любых магазинах» (SPEC п.11).
// Каталог универсальных чековых акций: без выбора магазина, со своими поиском и чипсами.
// Фильтры лежат в ctx.instance и переживают открытие акции, потому что экран не уничтожается.

export const presentation = 'sheet';
export const sheetPosition = 'full';

// Текст, по которому ищем: название, бренд, товары и варианты.
function haystack(offer, normalize) {
  const items = (offer.items || []).map((item) => `${item.name} ${item.variant || ''}`).join(' ');
  return normalize(`${offer.short_title} ${offer.title} ${offer.brand} ${items}`);
}

function allOffers(data) {
  return data.getUniversalOffers().sort((a, b) => b.rate - a.rate || a.id.localeCompare(b.id));
}

function chipItems(offers, activeId, data) {
  const present = new Set(offers.map((offer) => offer.product_category_id));
  if (activeId) present.add(activeId);
  const cats = data.getCategories().product.filter((cat) => present.has(cat.id));
  return [{ id: '__all', name: 'Все' }, ...cats];
}

// Короткая строка «где». Своя, пока ui.shortWhere пишет id сети («lenta») и прячет сеть, если есть маркетплейсы.
function whereLine(offer, data) {
  const where = offer.where || {};
  if (where.type === 'chain') return offer.where_text || '';
  const channels = where.channels || [];
  const both = channels.includes('offline') && channels.includes('online');
  let text = both ? 'Офлайн и онлайн'
    : channels.includes('online') ? 'Только онлайн' : 'Только офлайн';
  const markets = ['Ozon', 'Wildberries', 'Яндекс Маркет', 'Мегамаркет'];
  const excluded = where.excluded || [];
  const parts = [];
  if (excluded.some((name) => markets.includes(name))) parts.push('маркетплейсов');
  const chains = excluded
    .filter((name) => !markets.includes(name))
    .map((id) => data.getChain(id)?.name)
    .filter(Boolean);
  if (chains.length === 1) parts.push(`сети «${chains[0]}»`);
  else if (chains.length) parts.push(`сетей ${chains.map((name) => `«${name}»`).join(', ')}`);
  if (parts.length) text += `, кроме ${parts.join(' и ')}`;
  return text;
}

function cardHTML(offer, ctx) {
  const html = ctx.ui.productCard(offer, { where: false });
  const line = ctx.format.escapeHtml(whereLine(offer, ctx.data));
  return html.replace('</button>', `<span class="product-card__where">${line}</span></button>`);
}

function visible(offers, inst, normalize) {
  const query = normalize(inst.query);
  const words = query ? query.split(' ') : [];
  return offers.filter((offer) =>
    (!inst.category || offer.product_category_id === inst.category) &&
    words.every((word) => haystack(offer, normalize).includes(word)));
}

function paint(container, ctx) {
  const { ui, data, format } = ctx;
  const inst = ctx.instance;
  const offers = allOffers(data);
  container.querySelector('.universal__chips').innerHTML = ui.chips(
    chipItems(offers, inst.category, data),
    inst.category || '__all',
  );
  const list = visible(offers, inst, format.normalize);
  const grid = container.querySelector('.universal__grid');
  if (!offers.length) {
    grid.innerHTML = ui.emptyState({
      title: 'Пока нет таких акций',
      text: 'Универсальные акции появятся здесь.',
    });
    return;
  }
  if (!list.length) {
    grid.innerHTML = ui.emptyState({
      title: 'Ничего не нашли',
      text: 'Измените запрос или категорию. Фильтры сами не сбрасываются.',
      actions: [{ label: 'Сбросить фильтр', action: 'reset' }],
    });
    return;
  }
  grid.innerHTML = `<div class="product-grid">${list.map((offer) => cardHTML(offer, ctx)).join('')}</div>`;
}

export function render(container, params, ctx) {
  const { ui, data, format, router } = ctx;
  const inst = ctx.instance;
  inst.query = '';
  inst.category = null;
  const total = allOffers(data).length;

  container.innerHTML = `
    <div class="screen-head" data-sheet-drag>
      <button class="icon-btn screen-head__back" type="button" data-back aria-label="Назад">${ui.icon('back')}</button>
      <div class="screen-head__title">В любых магазинах</div>
    </div>
    <div class="universal">
      <p class="universal__lead">Кэшбэк за товар без привязки к одной сети. Ограничения написаны на карточке.</p>
      <div class="universal__tools">
        ${ui.searchField({ placeholder: 'Товар или бренд', value: '' })}
        <div class="universal__chips"></div>
      </div>
      <div class="universal__count"><span class="tag-receipt">По чеку</span> ${total} ${format.plural(total, ['акция', 'акции', 'акций'])}</div>
      <div class="universal__grid"></div>
      <div class="disclaimer">${ui.icon('info')}<span>Наличие товаров уточняйте в магазине. Акция не гарантирует, что товар есть на полке.</span></div>
    </div>`;
  paint(container, ctx);

  const input = container.querySelector('.search__input');
  const clearBtn = container.querySelector('.search__clear');
  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value;
    clearTimeout(inst.timer);
    inst.timer = setTimeout(() => {
      inst.query = input.value;
      paint(container, ctx);
    }, 120);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') input.blur();
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    inst.query = '';
    paint(container, ctx);
  });

  container.addEventListener('click', (event) => {
    if (event.target.closest('[data-back]')) {
      router.back();
      return;
    }
    const chip = event.target.closest('[data-chip-id]');
    if (chip) {
      inst.category = chip.dataset.chipId === '__all' ? null : chip.dataset.chipId;
      paint(container, ctx);
      return;
    }
    if (event.target.closest('[data-action="reset"]')) {
      inst.category = null;
      inst.query = '';
      input.value = '';
      clearBtn.hidden = true;
      paint(container, ctx);
      return;
    }
    const card = event.target.closest('[data-offer-id]');
    if (card) router.push('offer', { offerId: card.dataset.offerId });
  });
}

export function destroy(container, ctx) {
  clearTimeout(ctx.instance.timer);
}
