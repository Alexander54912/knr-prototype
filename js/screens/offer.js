// offer.js — экран чековой акции (SPEC п.12–13, 15, 17).
// Полноэкранный: шапка цвета акции, условия, карта только если точки известны.

export const presentation = 'page';
export const sheetPosition = null;

function inkFor(hex) {
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return lum > 0.62 ? '#1A1A1A' : '#FFFFFF';
}

function hasId(list, id) {
  return (list || []).includes(id);
}

function cashbackHTML(offer, format) {
  if (offer.mechanic === 'tiers_in_receipt' && offer.tiers) {
    const rows = offer.tiers.map((tier) => {
      const range = tier.to_rub == null
        ? `от ${format.formatRub(tier.from_rub)}`
        : `${format.formatRub(tier.from_rub)} – ${format.formatRub(tier.to_rub)}`;
      return `<div class="offer-tier"><span>${range}</span><b>${tier.rate}%</b></div>`;
    }).join('');
    return `<p class="offer-card__lead">Ставка зависит от суммы товаров акции в чеке.</p>${rows}`;
  }
  if (offer.mechanic === 'cumulative' && offer.cumulative) {
    const n = offer.cumulative.purchases;
    const word = format.plural(n, ['покупку', 'покупки', 'покупок']);
    return `<p class="offer-card__lead">${offer.rate}% за ${n} ${word} за время акции.</p>`;
  }
  return `<p class="offer-card__lead">Кэшбэк ${offer.rate}% за покупку по условиям акции.</p>`;
}

function actionsHTML(offer, ctx) {
  const { ui, state } = ctx;
  if (offer.status === 'expired') {
    return `<button class="btn btn--secondary btn--block" type="button" data-others>Смотреть другие акции</button>`;
  }
  const needs = offer.requires_activation && !hasId(state.get('activated'), offer.id);
  if (needs) {
    return `<button class="btn btn--primary btn--block btn--sticky" type="button" data-activate>Активировать</button>`;
  }
  const note = offer.requires_activation
    ? `<p class="offer-activated">${ui.icon('check')} Акция активирована</p>` : '';
  return `${note}<button class="btn btn--primary btn--block btn--sticky" type="button" data-receipt>Добавить чек</button>`;
}

function bodyHTML(offer, places, ctx) {
  const { format, ui } = ctx;
  const items = (offer.items || []).map((item) => `
    <div class="offer-item">
      <div class="offer-item__name">${format.escapeHtml(item.name)}</div>
      ${item.variant ? `<div class="offer-item__variant">${format.escapeHtml(item.variant)}</div>` : ''}
    </div>`).join('');
  const steps = (offer.how_to || []).map((step) => `<li>${format.escapeHtml(step)}</li>`).join('');
  const mapBtn = places.length
    ? `<button class="btn btn--secondary btn--block" type="button" data-map>${ui.icon('map')} Показать на карте</button>`
    : '';
  const limit = offer.max_bonus
    ? `<p class="offer-card__note">Максимум — ${format.escapeHtml(format.formatBonus(offer.max_bonus))}</p>` : '';
  return `
    ${offer.status === 'expired' ? '<div class="offer-banner">Акция закончилась</div>' : ''}
    <section class="offer-card">
      <h2>На что действует акция</h2>
      ${items}
      <div class="offer-qty">${format.escapeHtml(offer.qty_rule || '')}</div>
    </section>
    <section class="offer-card">
      <h2>Ваш кэшбэк</h2>
      ${cashbackHTML(offer, format)}
      ${limit}
    </section>
    <section class="offer-card">
      <h2>Где купить</h2>
      <p class="offer-card__text">${format.escapeHtml(offer.where_text || '')}</p>
      ${mapBtn}
    </section>
    <section class="offer-card">
      <h2>Как получить кэшбэк</h2>
      <ol class="offer-steps">${steps}</ol>
    </section>
    <div class="offer-actions">${actionsHTML(offer, ctx)}</div>`;
}

function paint(container, offer, places, ctx) {
  const { format, ui, state } = ctx;
  const fav = hasId(state.get('favorites'), offer.id);
  const ink = inkFor(offer.bg_color || '#3A3A3C');
  container.innerHTML = `
    <article class="offer" style="--offer-bg:${offer.bg_color || '#3A3A3C'};--offer-ink:${ink}">
      <header class="offer-hero">
        <div class="offer-hero__bar">
          <button class="icon-btn" type="button" data-back aria-label="Назад">${ui.icon('back')}</button>
          <button class="icon-btn" type="button" data-fav aria-pressed="${fav ? 'true' : 'false'}" aria-label="В избранное">${ui.icon(fav ? 'heart-filled' : 'heart')}</button>
        </div>
        <h1 class="offer-hero__title">${format.escapeHtml(offer.title)}</h1>
        <div class="offer-hero__meta">
          <span class="badge badge--cashback">${format.escapeHtml(format.formatRate(offer))}</span>
          <span class="tag-receipt">По чеку</span>
          <span class="offer-hero__deadline">${format.escapeHtml(format.formatDeadline(offer))}</span>
        </div>
        <div class="offer-hero__art">${ui.productImage(offer, 'm')}</div>
      </header>
      <div class="offer-body">${bodyHTML(offer, places, ctx)}</div>
    </article>`;
}

export function render(container, params, ctx) {
  const { data, router, ui, state } = ctx;
  const offer = data.getOffer(params.offerId);
  if (!offer) {
    container.innerHTML = ui.emptyState({
      title: 'Акция не найдена',
      text: 'Возможно, ссылка устарела.',
      actions: [{ label: 'Назад', action: 'back' }],
    });
    container.addEventListener('click', () => router.back());
    return;
  }
  const places = data.getOfferPlaces(offer);
  paint(container, offer, places, ctx);

  container.addEventListener('click', (event) => {
    if (event.target.closest('[data-back]') || event.target.closest('[data-action="back"]')) {
      router.back();
      return;
    }
    if (event.target.closest('[data-fav]')) {
      const list = state.get('favorites');
      const next = hasId(list, offer.id) ? list.filter((id) => id !== offer.id) : [...list, offer.id];
      state.set({ favorites: next });
      const btn = container.querySelector('[data-fav]');
      const on = hasId(next, offer.id);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.innerHTML = ui.icon(on ? 'heart-filled' : 'heart');
      return;
    }
    if (event.target.closest('[data-activate]')) {
      const list = state.get('activated');
      if (!hasId(list, offer.id)) state.set({ activated: [...list, offer.id] });
      ui.toast('Акция активирована');
      container.querySelector('.offer-actions').innerHTML = actionsHTML(offer, ctx);
      return;
    }
    if (event.target.closest('[data-receipt]')) {
      router.push('receipt', { offerId: offer.id });
      return;
    }
    if (event.target.closest('[data-map]')) {
      router.push('map-context', { mode: 'offer', offerId: offer.id });
      return;
    }
    if (event.target.closest('[data-others]')) {
      if (router.depth() > 2) router.back();
      else router.push('universal');
    }
  });
}

export function destroy() {}

// Вернулись из «Добавить чек»: тост, если чек отправили.
export function onResume(container, result, ctx) {
  if (result?.receipt === 'ok') ctx.ui.toast('Чек принят на проверку');
}
