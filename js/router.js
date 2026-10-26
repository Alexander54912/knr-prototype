// router.js — стек экранов + синхронизация с history (кнопка «Назад» браузера, свайп, Esc).
//
// Запись стека: { id, name, params, module, container, layer, ctx, saved }
// saved — положение шторки и вид карты под экраном, чтобы вернуть их при возврате.

// Загрузчики экранов. Динамический import: ошибка в одном экране не ломает остальные.
const LOADERS = {
  home: () => import('./screens/home.js'),
  store: () => import('./screens/store.js'),
  'address-picker': () => import('./screens/address-picker.js'),
  'about-place': () => import('./screens/about-place.js'),
  'map-context': () => import('./screens/map-context.js'),
  universal: () => import('./screens/universal.js'),
  offer: () => import('./screens/offer.js'),
  receipt: () => import('./screens/receipt.js'),
  'location-picker': () => import('./screens/location-picker.js'),
  categories: () => import('./screens/categories.js'),
};

// Какой параметр кладём в адрес (#offer/rct_042) и как разбираем прямые ссылки.
const HASH_PARAM = {
  store: 'placeId',
  'address-picker': 'placeId',
  'about-place': 'placeId',
  offer: 'offerId',
  receipt: 'offerId',
  universal: null,
};

const ANIM_MS = 280;

const stack = [];
const modules = {};
let services = null;   // { state, data, format, sheet, map, ui, geo }
let layers = null;     // { sheet, page, modal } — DOM-контейнеры
let nextId = 1;
let pendingResult;     // результат для onResume при back(result)

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function loadModule(name) {
  if (modules[name]) return modules[name];
  if (!LOADERS[name]) throw new Error(`Неизвестный экран: ${name}`);
  modules[name] = await LOADERS[name]();
  return modules[name];
}

function hashFor(name, params = {}) {
  if (name === 'home') return '';
  const key = HASH_PARAM[name];
  const value = key ? params[key] : null;
  return `#${name}${value ? `/${encodeURIComponent(value)}` : ''}`;
}

function urlFor(name, params) {
  return `${location.pathname}${location.search}${hashFor(name, params)}`;
}

// Разобрать адрес вида #offer/rct_042 → { name, params }.
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw) return null;
  const [name, value] = raw.split('/');
  if (!(name in HASH_PARAM)) return null;
  const key = HASH_PARAM[name];
  return { name, params: key && value ? { [key]: decodeURIComponent(value) } : {} };
}

function topOf(layer) {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].layer === layer) return stack[i];
  }
  return null;
}

// Создать DOM-контейнер под экран в нужном слое.
function makeContainer(name, layer) {
  if (layer === 'modal') {
    const wrap = document.createElement('div');
    wrap.className = 'modal-layer';
    wrap.innerHTML = '<div class="modal-layer__backdrop" data-modal-close></div><section class="modal-layer__panel screen"></section>';
    wrap.querySelector('[data-modal-close]').addEventListener('click', () => back());
    layers.modal.appendChild(wrap);
    const panel = wrap.querySelector('section');
    panel.dataset.screen = name;
    return { el: panel, root: wrap };
  }
  const el = document.createElement('section');
  el.className = `screen screen--${layer}`;
  el.dataset.screen = name;
  layers[layer].appendChild(el);
  return { el, root: el };
}

// Запустить CSS-анимацию появления/ухода через классы.
function animateIn(root) {
  if (reducedMotion()) return;
  root.classList.add('is-entering');
  root.getBoundingClientRect(); // принудительный reflow, чтобы переход сработал
  requestAnimationFrame(() => root.classList.remove('is-entering'));
}

function animateOut(root, done) {
  if (reducedMotion()) { done(); return; }
  root.classList.add('is-leaving');
  setTimeout(done, ANIM_MS);
}

// Спрятать/показать экран-подложку того же слоя (DOM остаётся — скролл сохраняется).
function cover(entry) {
  if (!entry) return;
  entry.root.classList.add('is-covered');
}

function uncover(entry) {
  if (!entry) return;
  entry.root.classList.remove('is-covered');
}

function makeCtx(entry) {
  return {
    ...services,
    router,
    instance: {},
    entry: { name: entry.name, params: entry.params },
  };
}

// Запомнить положение шторки и вид карты под текущим верхним экраном.
function saveTopContext() {
  const top = stack[stack.length - 1];
  if (!top || !services) return;
  top.saved = {
    sheetPos: services.sheet?.getPosition?.(),
    mapView: services.map?.getView?.(),
  };
}

// Вернуть сохранённое положение шторки и вид карты.
function restoreContext(entry) {
  if (!entry || !entry.saved || !services) return;
  const { sheetPos, mapView } = entry.saved;
  if (sheetPos && services.sheet?.getPosition?.() !== sheetPos) services.sheet.setPosition(sheetPos);
  if (mapView) services.map?.setView?.(mapView, { animate: false });
}

async function openEntry(name, params, { animate = true, saveContext = true } = {}) {
  const mod = await loadModule(name);
  const layer = mod.presentation || 'sheet';
  if (saveContext) saveTopContext();
  const prevSameLayer = topOf(layer);
  const { el, root } = makeContainer(name, layer);
  const entry = { id: nextId++, name, params: params || {}, module: mod, container: el, root, layer, saved: null };
  entry.ctx = makeCtx(entry);
  stack.push(entry);
  syncDepthClass();

  // sheetPosition — строка или функция (params) → положение.
  const pos = typeof mod.sheetPosition === 'function' ? mod.sheetPosition(entry.params) : mod.sheetPosition;
  if (layer === 'sheet' && pos) services.sheet?.setPosition?.(pos);
  try {
    mod.render(el, entry.params, entry.ctx);
  } catch (err) {
    console.error(`[router] ошибка в render экрана ${name}`, err);
    el.innerHTML = `<div class="empty"><div class="empty__title">Экран «${name}» не открылся</div><div class="empty__text">${String(err.message)}</div></div>`;
  }
  if (animate && stack.length > 1) animateIn(root);
  if (prevSameLayer) {
    if (animate && !reducedMotion()) setTimeout(() => cover(prevSameLayer), ANIM_MS);
    else cover(prevSameLayer);
  }
  return entry;
}

function closeTop({ animate = true } = {}) {
  if (stack.length <= 1) return null;
  const entry = stack.pop();
  syncDepthClass();
  try {
    entry.module.destroy?.(entry.container, entry.ctx);
  } catch (err) {
    console.error(`[router] ошибка в destroy экрана ${entry.name}`, err);
  }
  uncover(topOf(entry.layer));
  const remove = () => entry.root.remove();
  if (animate) animateOut(entry.root, remove);
  else remove();
  return entry;
}

// Экран снова сверху: вернуть контекст и сообщить экрану.
function resumeTop(result) {
  const top = stack[stack.length - 1];
  if (!top) return;
  restoreContext(top);
  try {
    top.module.onResume?.(top.container, result, top.ctx);
  } catch (err) {
    console.error(`[router] ошибка в onResume экрана ${top.name}`, err);
  }
}

function syncDepthClass() {
  document.documentElement.dataset.depth = String(stack.length);
  const top = stack[stack.length - 1];
  document.documentElement.dataset.topScreen = top ? top.name : '';
  window.dispatchEvent(new CustomEvent('router:change', { detail: { name: top?.name, depth: stack.length } }));
}

// --- Публичное API --------------------------------------------------------

async function push(name, params = {}) {
  const entry = await openEntry(name, params);
  history.pushState({ depth: stack.length, name, params: entry.params }, '', urlFor(name, entry.params));
  return entry;
}

// Закрыть верхний экран через history.back(), чтобы история браузера не расходилась со стеком.
function back(result) {
  if (stack.length <= 1) return;
  pendingResult = result;
  history.back();
}

// Закрыть экраны до ближайшего name (сам name остаётся сверху).
function backTo(name, result) {
  let i = stack.length - 1;
  while (i >= 0 && stack[i].name !== name) i -= 1;
  if (i < 0 || i === stack.length - 1) return;
  pendingResult = result;
  history.go(-(stack.length - 1 - i));
}

async function replace(name, params = {}) {
  if (stack.length <= 1) return push(name, params);
  closeTop({ animate: false });
  // Контекст экрана ниже не перезаписываем: «назад» должен вернуть вид карты до первого экрана.
  const entry = await openEntry(name, params, { animate: false, saveContext: false });
  history.replaceState({ depth: stack.length, name, params: entry.params }, '', urlFor(name, entry.params));
  return entry;
}

// Обновить параметры верхнего экрана (например, магазин сменил адрес) и адрес в строке браузера.
function setParams(patch) {
  const top = stack[stack.length - 1];
  if (!top) return;
  Object.assign(top.params, patch);
  history.replaceState({ depth: stack.length, name: top.name, params: top.params }, '', urlFor(top.name, top.params));
}

function current() {
  const top = stack[stack.length - 1];
  return top ? { name: top.name, params: top.params } : null;
}

function depth() {
  return stack.length;
}

// Обработка «Назад»/«Вперёд» браузера.
async function onPopState(e) {
  const target = e.state?.depth;
  if (!target) {
    // Адрес поменяли руками (#offer/...) — открыть заново поверх главного.
    while (stack.length > 1) closeTop({ animate: false });
    const link = parseHash();
    history.replaceState({ depth: 1, name: 'home' }, '', urlFor('home'));
    if (link) await push(link.name, link.params);
    return;
  }
  if (target < stack.length) {
    while (stack.length > target) closeTop();
    const result = pendingResult;
    pendingResult = undefined;
    resumeTop(result);
  } else if (target > stack.length && e.state.name) {
    // «Вперёд» в браузере: открыть экран снова.
    await openEntry(e.state.name, e.state.params);
  }
}

// Старт: главный экран + прямая ссылка из адреса, если есть.
async function init(svc, containers) {
  services = svc;
  layers = containers;
  const link = parseHash();
  history.replaceState({ depth: 1, name: 'home' }, '', urlFor('home'));
  await openEntry('home', {}, { animate: false });
  window.addEventListener('popstate', onPopState);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length > 1 && !e.target.closest?.('input, textarea')) back();
  });
  if (link) await push(link.name, link.params);
}

export const router = { init, push, back, backTo, replace, setParams, current, depth };
