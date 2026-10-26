// categories.js — «Ещё»: все категории мест сеткой (трек A, SPEC п.4).
export const presentation = 'modal';

export function render(container, params, ctx) {
  const { data, state, ui, format, router } = ctx;
  const active = state.get('category');
  const cats = data.getCategories().place;

  container.innerHTML = `
    <div class="screen-head">
      <div class="screen-head__title">Категории</div>
      <button class="icon-btn screen-head__close" type="button" data-close aria-label="Закрыть">${ui.icon('close')}</button>
    </div>
    <div class="cat-grid">
      ${cats.map((c) => `
        <button class="cat-tile${c.id === active ? ' is-active' : ''}" type="button" data-id="${format.escapeHtml(c.id)}">
          ${ui.logo({ color: c.color, letters: c.name.charAt(0), icon: c.icon }, 'm')}
          <span class="cat-tile__name">${format.escapeHtml(c.name)}</span>
        </button>`).join('')}
    </div>
    <div class="cat-actions">
      <button class="btn btn--secondary btn--block" type="button" data-reset${active ? '' : ' disabled'}>Все категории</button>
    </div>`;

  container.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { router.back(); return; }
    if (e.target.closest('[data-reset]')) { state.set({ category: null }); router.back(); return; }
    const tile = e.target.closest('[data-id]');
    if (tile) {
      state.set({ category: tile.dataset.id === active ? null : tile.dataset.id });
      router.back();
    }
  });
}

export function destroy() {}
