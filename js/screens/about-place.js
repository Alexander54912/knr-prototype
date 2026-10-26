// about-place.js — «О магазине»: фото, адрес, часы, телефон (трек A, SPEC п.14).
// Дополнительный экран; закрытие возвращает к каталогу с прежними фильтрами и скроллом.

export const presentation = 'sheet';
export const sheetPosition = 'full';

// Фото-заглушка: плитка цвета места с подписью (настоящих фото в прототипе нет).
function photoHTML(src, i, visual, format) {
  const img = src ? `<img src="${format.escapeHtml(src)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<div class="about-photo" style="--photo-bg:${visual.color}"><span>Фото ${i + 1}</span>${img}</div>`;
}

export function render(container, params, ctx) {
  const { data, format, ui, geo, state, router } = ctx;
  const place = data.getPlace(params.placeId);
  const visual = data.getPlaceVisual(place);
  const cat = data.getCategory(place.category_id);
  const distance = geo.distanceM(place, state.get('location'));
  const photos = place.photos?.length ? place.photos : [null, null];
  const formatName = { near_home: 'Магазин у дома', supermarket: 'Супермаркет', hypermarket: 'Гипермаркет', discounter: 'Дискаунтер' }[place.format];
  const line = (ic, title, text) => `
    <div class="about-line">${ui.icon(ic)}<div><div class="about-line__title">${format.escapeHtml(title)}</div><div class="about-line__text">${format.escapeHtml(text)}</div></div></div>`;

  container.innerHTML = `
    <div class="screen-head" data-sheet-drag>
      <button class="icon-btn screen-head__back" type="button" data-back aria-label="Назад">${ui.icon('back')}</button>
      <div class="screen-head__title">О магазине</div>
    </div>
    <div class="about-photos">${photos.map((p, i) => photoHTML(p, i, visual, format)).join('')}</div>
    <div class="about-head">
      ${ui.logo(visual, 'm')}
      <div>
        <h2 class="about-head__title">${format.escapeHtml(place.name)}</h2>
        <div class="about-head__sub">${format.escapeHtml([formatName || place.subcategory, cat?.name].filter(Boolean).join(' · '))}</div>
      </div>
    </div>
    <div class="card about-card">
      ${line('pin', 'Адрес', `${place.address} · ${format.formatDistance(distance)} от вас`)}
      ${place.hours ? line('clock', 'Часы работы', place.hours) : ''}
      ${place.phone ? line('phone', 'Телефон', place.phone) : ''}
      ${place.district ? line('map', 'Район', place.district) : ''}
    </div>
    <div class="about-actions">
      <button class="btn btn--secondary btn--block" type="button" data-back>К предложениям</button>
    </div>`;

  container.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) router.back();
  });
}

export function destroy() {}
