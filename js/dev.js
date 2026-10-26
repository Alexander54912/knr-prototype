// dev.js — dev-панель (?dev=1), трек A. Для показа продакту выключена по умолчанию.
// На десктопе — справа от телефона, на узком экране — выезжает по кнопке DEV.
import { DEMO_LOCATIONS } from './config.js';
import { escapeHtml } from './format.js';

let deps = null;
let panel = null;

// --- FPS при перемещении карты ---------------------------------------------
function watchFps() {
  const lmap = deps.map.leaflet();
  let frames = 0;
  let started = 0;
  let running = false;
  const tick = () => {
    if (!running) return;
    frames += 1;
    requestAnimationFrame(tick);
  };
  lmap.on('movestart zoomstart', () => {
    if (running) return;
    running = true;
    frames = 0;
    started = performance.now();
    requestAnimationFrame(tick);
  });
  lmap.on('moveend zoomend', () => {
    if (!running) return;
    running = false;
    const sec = (performance.now() - started) / 1000;
    if (sec < 0.15) return; // мгновенный прыжок — FPS не показателен
    const fps = Math.round(frames / sec);
    set('fps', `${fps} кадр/с за ${sec.toFixed(1)} с`);
    panel.querySelector('[data-k="fps"]').classList.toggle('is-bad', fps < 45);
  });
}

function set(key, text) {
  const el = panel.querySelector(`[data-k="${key}"]`);
  if (el) el.textContent = text;
}

function refreshStats() {
  const { map, state } = deps;
  set('filter', `${map.stats.lastFilterMs} мс · пинов ${map.stats.shown}`);
  set('screen', `${deps.router.current()?.name} · глубина ${deps.router.depth()}`);
  set('fav', `избранное ${state.get('favorites').length} · активировано ${state.get('activated').length}`);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#FFFFFF' : '#1C1C1E';
  deps.state.set({ theme });
}

export function init(d) {
  deps = d;
  const { state, data, router, map, ui } = deps;
  panel = document.getElementById('dev-panel');
  const expired = data.getExpiredOffers();
  const source = document.documentElement.dataset.dataSource;

  panel.hidden = false;
  panel.innerHTML = `
    <button class="dev-panel__toggle" type="button" data-act="toggle">DEV</button>
    <div class="dev-panel__body">
      <div class="dev-panel__title">Dev-панель</div>
      <div class="dev-row"><span>Данные</span><b>${source === 'full' ? 'полные' : 'пробные (sample)'} · ${data.getPlaces().length} мест</b></div>

      <label class="dev-row"><span>Тема</span>
        <select data-act="theme"><option value="dark">Тёмная</option><option value="light">Светлая</option></select></label>

      <label class="dev-row"><span>Ошибка загрузки чека</span><input type="checkbox" data-act="receipt-error"></label>

      <label class="dev-row"><span>Демо-локация</span>
        <select data-act="location">${DEMO_LOCATIONS.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('')}</select></label>

      <div class="dev-row"><span>Истёкшая акция</span>
        ${expired.length
          ? `<select data-act="expired">${expired.map((o) => `<option value="${o.id}">${escapeHtml(o.short_title)}</option>`).join('')}</select>
             <button type="button" data-act="open-expired">Открыть</button>`
          : '<b>нет в данных</b>'}</div>

      <div class="dev-row"><span>localStorage</span><button type="button" data-act="reset">Сбросить</button></div>

      <div class="dev-panel__title">Производительность</div>
      <div class="dev-row"><span>FPS (последнее перемещение)</span><b data-k="fps">подвигайте карту</b></div>
      <div class="dev-row"><span>Фильтр пинов</span><b data-k="filter"></b></div>
      <div class="dev-row"><span>Экран</span><b data-k="screen"></b></div>
      <div class="dev-row"><span>Состояние</span><b data-k="fav"></b></div>
    </div>`;

  panel.querySelector('[data-act="theme"]').value = state.get('theme');
  panel.querySelector('[data-act="receipt-error"]').checked = Boolean(state.get('dev').receiptError);

  panel.addEventListener('change', (e) => {
    const act = e.target.dataset.act;
    if (act === 'theme') applyTheme(e.target.value);
    if (act === 'receipt-error') state.set({ dev: { ...state.get('dev'), receiptError: e.target.checked } });
    if (act === 'location') {
      const loc = DEMO_LOCATIONS.find((l) => l.id === e.target.value);
      map.setLocation(loc.latlng, loc.name);
    }
  });
  panel.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') panel.classList.toggle('is-open');
    if (act === 'open-expired') router.push('offer', { offerId: panel.querySelector('[data-act="expired"]').value });
    if (act === 'reset') { state.resetStorage(); ui.toast('localStorage очищен'); }
  });

  watchFps();
  refreshStats();
  state.subscribe(null, refreshStats);
  window.addEventListener('router:change', refreshStats);
}
