// location-picker.js — «Уточнить адрес»: выбор демо-адреса в Москве (трек A, SPEC п.6).
import { DEMO_LOCATIONS } from '../config.js';

export const presentation = 'modal';

export function render(container, params, ctx) {
  const { ui, format, state, router } = ctx;
  const current = state.get('locationLabel');

  container.innerHTML = `
    <div class="screen-head">
      <div class="screen-head__title">Уточнить адрес</div>
      <button class="icon-btn screen-head__close" type="button" data-close aria-label="Закрыть">${ui.icon('close')}</button>
    </div>
    <p class="loc-hint">Геолокация недоступна или вы не в Москве — выберите адрес, вокруг которого показать предложения.</p>
    ${ui.searchField({ placeholder: 'Улица или метро' })}
    <div class="loc-list" role="list"></div>`;

  const list = container.querySelector('.loc-list');
  const input = container.querySelector('.search__input');
  const clear = container.querySelector('.search__clear');

  function draw() {
    const q = format.normalize(input.value);
    const items = DEMO_LOCATIONS.filter((l) => !q || format.normalize(`${l.name} ${l.address}`).includes(q));
    list.innerHTML = items.length
      ? items.map((l) => `
        <button class="row loc-row" type="button" role="listitem" data-id="${l.id}">
          <span class="row__logo loc-row__icon">${ui.icon('pin')}</span>
          <span class="row__body">
            <span class="row__title">${format.escapeHtml(l.name)}</span>
            <span class="row__sub">${format.escapeHtml(l.address)}</span>
          </span>
          ${l.name === current ? `<span class="loc-row__check">${ui.icon('check')}</span>` : ''}
        </button>`).join('')
      : ui.emptyState({ title: 'Адрес не найден', text: 'Попробуйте другое название улицы или станции метро.' });
    clear.hidden = !input.value;
  }

  input.addEventListener('input', draw);
  clear.addEventListener('click', () => { input.value = ''; draw(); input.focus(); });
  container.querySelector('[data-close]').addEventListener('click', () => router.back());
  list.addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const loc = DEMO_LOCATIONS.find((l) => l.id === row.dataset.id);
    // Карту двигает главный экран в onResume — после того, как роутер вернёт прежний вид.
    router.back({ location: loc });
  });
  draw();
}

export function destroy() {}
