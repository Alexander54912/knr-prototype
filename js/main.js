// main.js — точка входа: грузим данные, собираем модули, запускаем роутер.
import * as data from './data.js';
import * as format from './format.js';
import * as geo from './geo.js';
import { state } from './state.js';
import { router } from './router.js';
import { sheet } from './sheet.js';
import { map } from './map.js';
import { ui } from './ui.js';
import * as dev from './dev.js';
import { SEARCH_RADIUS_M } from './config.js';

async function start() {
  const params = new URLSearchParams(location.search);
  const theme = params.get('theme') === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  state.set({ theme });

  const { source } = await data.loadData();
  document.documentElement.dataset.dataSource = source;
  if (source === 'sample') console.info('[main] работаем на пробных данных data/sample/');

  // Область поиска по умолчанию — вокруг пользователя.
  state.set({ searchArea: geo.boundsAround(state.get('location'), SEARCH_RADIUS_M) });

  sheet.init(document.getElementById('sheet'));
  map.init(document.getElementById('map'));

  await router.init(
    { state, data, format, sheet, map, ui, geo },
    {
      sheet: document.getElementById('sheet-screens'),
      page: document.getElementById('pages'),
      modal: document.getElementById('modals'),
    },
  );

  // Нажатие на пин: в режиме «Только <сеть>» — вернуться в карточку с новым адресом,
  // в режиме «Где купить» — магазин с выбранной акцией первой, иначе — карточка магазина.
  map.setHandlers({
    onPlaceClick(place) {
      const mode = state.get('mapMode');
      const top = router.current();
      // Карточка уже открыта с карты — следующий пин заменяет её, а не копит стек.
      const openStore = (params) => (top.name === 'store' && (top.params.from === 'pin' || top.params.from === 'map')
        ? router.replace('store', params) : router.push('store', params));
      if (mode?.type === 'chain' || mode?.type === 'brand') router.backTo('store', { placeId: place.id });
      else if (mode?.type === 'offer') openStore({ placeId: place.id, from: 'map', highlightOfferId: mode.offerId });
      else openStore({ placeId: place.id, from: 'pin' });
    },
    onContextClose: () => router.back(),
    onAddressClick: () => router.push('location-picker'),
  });

  // Стрелка в шапке: закрыть верхний экран; на главном — выход из раздела (в прототипе некуда).
  document.getElementById('header-back').addEventListener('click', () => {
    if (router.depth() > 1) router.back();
    else ui.toast('В приложении здесь выход из раздела');
  });

  // Для отладки из консоли браузера: knr.state.get(), knr.router.current() и т.п.
  window.knr = { state, data, router, map, sheet };

  if (params.get('dev') === '1') dev.init({ state, data, router, map, ui });
}

start().catch((err) => {
  console.error('[main] не удалось запустить прототип', err);
  document.getElementById('app').insertAdjacentHTML('beforeend',
    `<div class="fatal">Не удалось запустить прототип: ${format.escapeHtml(err.message)}</div>`);
});
