// sheet.js — шторка и её положения (трек A). API — docs/CONTRACTS.md, раздел 6.
//
// Три положения: collapsed (ручка + строка поиска), mid (~2/3 экрана, стартовое), full (до низа шапки).
// Тянуть можно:
//  - мышью/пальцем за [data-sheet-drag] (ручка, шапки экранов);
//  - пальцем по содержимому: в mid/collapsed вертикальный жест двигает шторку,
//    в full содержимое скроллится, а жест вниз от самого верха списка опускает шторку.
import { SHEET } from './config.js';
import { icon } from './ui.js';

const ORDER = ['collapsed', 'mid', 'full'];
const SLOP = 6; // px — после этого сдвига решаем, что за жест

let el = null;
let app = null;
let fab = null;
let position = 'mid';
let currentY = 0;          // текущий сдвиг шторки вниз, px
const listeners = new Set();

// --- Геометрия -----------------------------------------------------------------

// Сдвиг шторки вниз (px) для положения pos. Высота шторки = высота экрана − шапка.
function offsetFor(pos) {
  const h = el.offsetHeight;
  const appH = app.offsetHeight;
  if (pos === 'full') return 0;
  if (pos === 'collapsed') return Math.max(0, h - SHEET.collapsedPx - safeBottom());
  return Math.max(0, h - appH * SHEET.midRatio);
}

// safe-area снизу в px: env() из JS не прочитать, поэтому меряем невидимый элемент.
let safeProbe = null;
function safeBottom() {
  return safeProbe ? safeProbe.offsetHeight : 0;
}

// Видимая высота шторки (px) в положении pos.
export function visibleHeight(pos = position) {
  return el.offsetHeight - offsetFor(pos);
}

// Координата верхнего края шторки (px от верха экрана) в положении pos.
export function topFor(pos = position) {
  return app.offsetHeight - visibleHeight(pos);
}

// Нарисовать шторку со сдвигом y (без смены логического положения).
function paint(y) {
  currentY = y;
  el.style.transform = `translateY(${y}px)`;
  app.style.setProperty('--sheet-visible', `${el.offsetHeight - y}px`);
}

// --- Положения -----------------------------------------------------------------

function apply(animate) {
  if (animate) {
    el.classList.add('is-animating');
    clearTimeout(apply.timer);
    apply.timer = setTimeout(() => el.classList.remove('is-animating'), SHEET.durationMs + 20);
  }
  paint(offsetFor(position));
  el.dataset.pos = position;
  app.dataset.sheet = position;
  renderFab();
}

export function setPosition(pos, { animate = true } = {}) {
  if (!ORDER.includes(pos)) return;
  const changed = pos !== position;
  position = pos;
  if (el) apply(animate);
  if (changed) listeners.forEach((fn) => fn(pos));
}

export function getPosition() {
  return position;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Куда прилипнуть после жеста: быстрый жест — в соседнее положение по направлению, иначе — ближайшее.
function snapTarget(y, velocity) {
  const offsets = ORDER.map((p) => ({ p, y: offsetFor(p) }));
  if (Math.abs(velocity) > SHEET.velocityThreshold) {
    // velocity > 0 — вниз (к collapsed), < 0 — вверх (к full)
    const sorted = [...offsets].sort((a, b) => a.y - b.y); // full, mid, collapsed
    if (velocity > 0) return (sorted.find((o) => o.y > y + 1) || sorted[sorted.length - 1]).p;
    return ([...sorted].reverse().find((o) => o.y < y - 1) || sorted[0]).p;
  }
  return offsets.reduce((best, o) => (Math.abs(o.y - y) < Math.abs(best.y - y) ? o : best)).p;
}

// --- Перетаскивание --------------------------------------------------------------

let drag = null; // { startY, startOffset, lastY, lastT, v }

function beginDrag(clientY) {
  el.classList.remove('is-animating');
  drag = { startY: clientY, startOffset: currentY, lastY: clientY, lastT: performance.now(), v: 0 };
  app.classList.add('is-sheet-dragging');
}

function moveDrag(clientY) {
  const now = performance.now();
  const dt = Math.max(1, now - drag.lastT);
  // Сглаженная скорость, px/мс
  drag.v = 0.7 * ((clientY - drag.lastY) / dt) + 0.3 * drag.v;
  drag.lastY = clientY;
  drag.lastT = now;
  let y = drag.startOffset + (clientY - drag.startY);
  const min = 0;
  const max = offsetFor('collapsed');
  // «Резинка» за крайними положениями
  if (y < min) y = min + (y - min) * 0.25;
  if (y > max) y = max + (y - max) * 0.25;
  paint(y);
}

function endDrag() {
  const target = snapTarget(currentY, drag.v);
  drag = null;
  app.classList.remove('is-sheet-dragging');
  setPosition(target);
  if (target === position) apply(true); // то же положение — просто вернуться на место
}

// Мышь и палец за ручку / шапку.
function onPointerDown(e) {
  const zone = e.target.closest('[data-sheet-drag]');
  if (!zone || !el.contains(zone)) return;
  if (e.target.closest('button, input, a, .chips')) return; // кнопки и поле поиска остаются кликабельными
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const startY = e.clientY;
  let started = false;
  const move = (ev) => {
    if (!started) {
      if (Math.abs(ev.clientY - startY) < SLOP) return;
      started = true;
      beginDrag(startY);
    }
    moveDrag(ev.clientY);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (started) endDrag();
    else if (e.target.closest('.sheet__grab')) setPosition(position === 'full' ? 'mid' : 'full'); // тап по ручке
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

// Палец по содержимому экрана.
function onTouchStart(e) {
  if (e.touches.length !== 1 || e.target.closest('[data-sheet-drag]')) return;
  const scroller = e.target.closest('.screen--sheet');
  if (!scroller) return;
  const t = e.touches[0];
  const g = { x: t.clientX, y: t.clientY, scroller, mode: null };

  const move = (ev) => {
    const p = ev.touches[0];
    const dx = p.clientX - g.x;
    const dy = p.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      if (Math.abs(dx) > Math.abs(dy)) { g.mode = 'native'; return; } // горизонтально — чипсы, карусели
      const atTop = g.scroller.scrollTop <= 0;
      const sheetGesture = position !== 'full' || (atTop && dy > 0);
      g.mode = sheetGesture ? 'sheet' : 'native';
      if (g.mode === 'sheet') beginDrag(g.y);
    }
    if (g.mode === 'sheet') {
      ev.preventDefault(); // не даём списку скроллиться, пока тянем шторку
      moveDrag(p.clientY);
    }
  };
  const end = () => {
    el.removeEventListener('touchmove', move);
    el.removeEventListener('touchend', end);
    el.removeEventListener('touchcancel', end);
    if (g.mode === 'sheet') endDrag();
  };
  el.addEventListener('touchmove', move, { passive: false });
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}

// --- Кнопки «Карта» / «Список» ----------------------------------------------------

// Показываем только на главном экране и в режиме карты (контекст).
function renderFab() {
  if (!fab) return;
  const screen = document.documentElement.dataset.topScreen;
  const allowed = screen === 'home' || screen === 'map-context';
  let html = '';
  if (allowed && position === 'full') html = `<button class="fab" type="button" data-to="collapsed">${icon('pin')}<span>Карта</span></button>`;
  if (allowed && position === 'collapsed') html = `<button class="fab" type="button" data-to="mid">${icon('list')}<span>Список</span></button>`;
  if (fab.dataset.html !== html) {
    fab.innerHTML = html;
    fab.dataset.html = html;
  }
}

// --- Запуск -----------------------------------------------------------------------

export function init(sheetEl) {
  el = sheetEl;
  app = el.closest('.app');
  fab = document.getElementById('fab');
  safeProbe = document.createElement('div');
  safeProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--safe-bottom)';
  app.appendChild(safeProbe);
  apply(false);

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  fab.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-to]');
    if (btn) setPosition(btn.dataset.to);
  });
  window.addEventListener('resize', () => apply(false));
  window.addEventListener('router:change', renderFab);
}

export const sheet = { init, setPosition, getPosition, onChange, visibleHeight, topFor };
