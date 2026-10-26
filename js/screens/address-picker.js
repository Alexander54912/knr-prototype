// address-picker.js — «Выбрать другой адрес» (трек A, SPEC п.10).
// До 20 ближайших точек той же сети (или FuSe-бренда). Выбор → назад в карточку с новым адресом.
import { ADDRESS_PICKER_LIMIT } from '../config.js';

export const presentation = 'sheet';
export const sheetPosition = 'full';

export function render(container, params, ctx) {
  const { data, format, ui, geo, state, router } = ctx;
  const current = data.getPlace(params.placeId);
  const loc = state.get('location');
  const owner = current.chain_id ? data.getChain(current.chain_id) : data.getBrand(current.brand_id);
  const name = owner?.name || current.name;
  const siblings = data.getSiblingsNear(current, loc, ADDRESS_PICKER_LIMIT);
  // Текущий адрес всегда в списке, даже если он дальше двадцатого.
  if (!siblings.some((s) => s.place.id === current.id)) {
    siblings.push({ place: current, distance: geo.distanceM(current, loc) });
  }

  const rows = siblings.map(({ place, distance }) => {
    const n = data.getStoreCatalog(place).length;
    const isCurrent = place.id === current.id;
    return `
      <button class="row addr-row${isCurrent ? ' is-current' : ''}" type="button" data-place-id="${format.escapeHtml(place.id)}" aria-current="${isCurrent}">
        <span class="row__logo">${ui.logo(data.getPlaceVisual(place), 'm')}</span>
        <span class="row__body">
          <span class="row__title">${format.escapeHtml(place.address)}</span>
          <span class="row__sub">${format.escapeHtml(format.formatDistance(distance))} · ${format.escapeHtml(format.formatWalk(distance))} пешком</span>
          ${n ? `<span class="row__meta"><span class="tag-receipt">По чеку</span> ${n} ${format.plural(n, ['акция', 'акции', 'акций'])}</span>` : ''}
        </span>
        <span class="addr-row__check">${isCurrent ? ui.icon('check') : ''}</span>
      </button>`;
  }).join('');

  container.innerHTML = `
    <div class="screen-head" data-sheet-drag>
      <button class="icon-btn screen-head__back" type="button" data-back aria-label="Назад">${ui.icon('back')}</button>
      <div class="screen-head__title">Адреса «${format.escapeHtml(name)}»</div>
      <button class="btn btn--accent addr-map-btn" type="button" data-on-map>${ui.icon('map')}На карте</button>
    </div>
    <p class="addr-hint">Ближайшие ${siblings.length} ${format.plural(siblings.length, ['магазин', 'магазина', 'магазинов'])} к вам</p>
    <div class="addr-list">${rows}</div>`;

  container.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { router.back(); return; }
    if (e.target.closest('[data-on-map]')) {
      router.push('map-context', current.chain_id
        ? { mode: 'chain', chainId: current.chain_id, pickForPlaceId: current.id }
        : { mode: 'brand', brandId: current.brand_id, pickForPlaceId: current.id });
      return;
    }
    const row = e.target.closest('[data-place-id]');
    if (row) router.back({ placeId: row.dataset.placeId });
  });
}

export function destroy() {}
