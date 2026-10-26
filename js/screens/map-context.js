// map-context.js — карта в особом режиме (трек A, SPEC п.10, 13).
//  mode 'chain' / 'brand' — «Только <сеть>»: выбор адреса на карте → назад в карточку магазина.
//  mode 'offer' — «Где купить: <акция>»: точки, где действует акция → магазин с акцией первой; «назад» — в акцию.
import { chainRow, placeRow } from '../rows.js';

export const presentation = 'sheet';
export const sheetPosition = 'collapsed';

const LIST_LIMIT = 20;

export function render(container, params, ctx) {
  const { data, format, ui, map, state, geo, router } = ctx;
  const loc = state.get('location');
  let title = '';
  let hint = '';
  let places = [];

  if (params.mode === 'offer') {
    const offer = data.getOffer(params.offerId);
    places = data.getOfferPlaces(offer);
    title = `Где купить: ${offer?.short_title || 'акция'}`;
    hint = 'Выберите магазин — акция будет первой в каталоге';
    map.showOfferContext(params.offerId);
  } else {
    const owner = params.mode === 'brand' ? data.getBrand(params.brandId) : data.getChain(params.chainId);
    places = params.mode === 'brand' ? data.getPlaces({ brandId: params.brandId }) : data.getPlaces({ chainId: params.chainId });
    title = `Только ${owner?.name || ''}`;
    hint = 'Выберите адрес на карте или в списке';
    if (params.mode === 'brand') map.showBrandOnly(params.brandId, { around: data.getPlace(params.pickForPlaceId) });
    else map.showChainOnly(params.chainId, { around: data.getPlace(params.pickForPlaceId) });
  }

  const near = places
    .map((place) => ({ place, distance: geo.distanceM(place, loc) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, LIST_LIMIT);
  const rows = near.map(({ place, distance }) => {
    if (params.mode !== 'offer') {
      const mark = place.id === params.pickForPlaceId ? ' is-current' : '';
      return `
        <button class="row addr-row${mark}" type="button" data-place-id="${format.escapeHtml(place.id)}">
          <span class="row__logo">${ui.logo(data.getPlaceVisual(place), 'm')}</span>
          <span class="row__body"><span class="row__title">${format.escapeHtml(place.address)}</span>
          <span class="row__sub">${format.escapeHtml(format.formatDistance(distance))} · ${format.escapeHtml(format.formatWalk(distance))} пешком</span></span>
          <span class="addr-row__check">${mark ? ui.icon('check') : ''}</span>
        </button>`;
    }
    return place.kind === 'chain_store' ? chainRow(place, distance) : placeRow(place, distance);
  }).join('');

  container.innerHTML = `
    <div class="ctx-head" data-sheet-drag>
      <div class="ctx-head__title">${format.escapeHtml(title)}</div>
      <div class="ctx-head__sub">${format.escapeHtml(hint)} · ${places.length} ${format.plural(places.length, ['точка', 'точки', 'точек'])}</div>
    </div>
    <div class="ctx-list">${rows || ui.emptyState({ title: 'Рядом нет подходящих магазинов' })}</div>`;

  container.addEventListener('click', (e) => {
    const row = e.target.closest('[data-place-id]');
    if (!row) return;
    const placeId = row.dataset.placeId;
    if (params.mode === 'offer') router.push('store', { placeId, from: 'list', highlightOfferId: params.offerId });
    else router.backTo('store', { placeId });
  });
}

export function destroy(container, ctx) {
  ctx.map.clearContext();
}
