// receipt.js — «Добавить чек» (SPEC п.15).
// QR здесь имитация: камеру не открываем. Файл никуда не отправляется.
// Успех — «Чек принят на проверку», не «кэшбэк начислен».

export const presentation = 'modal';

const WAIT_MS = 1200;

function draw(container, ctx) {
  const { ui, format } = ctx;
  const phase = ctx.instance.phase;
  const offer = ctx.data.getOffer(ctx.instance.offerId);
  const name = offer ? format.escapeHtml(offer.short_title) : 'акция';

  let body = '';
  if (phase === 'choose') {
    body = `
      <p class="receipt__lead">Чек должен относиться к акции «${name}».</p>
      <button class="receipt-choice" type="button" data-qr>
        <span class="receipt-choice__icon">${ui.icon('qr')}</span>
        <span>
          <span class="receipt-choice__title">Сканировать QR</span>
          <span class="receipt-choice__sub">Код на чеке</span>
        </span>
      </button>
      <button class="receipt-choice" type="button" data-file>
        <span class="receipt-choice__icon">${ui.icon('image')}</span>
        <span>
          <span class="receipt-choice__title">Загрузить фото</span>
          <span class="receipt-choice__sub">Снимок или скриншот чека</span>
        </span>
      </button>
      <input class="receipt__file" type="file" accept="image/*" hidden>`;
  } else if (phase === 'qr') {
    body = `
      <p class="receipt__lead">Наведите рамку на QR-код чека. Это имитация, камера не включается.</p>
      <div class="receipt-finder" aria-hidden="true"><span class="receipt-finder__line"></span></div>
      <button class="btn btn--primary btn--block" type="button" data-scan>Считать код</button>
      <button class="btn btn--ghost btn--block" type="button" data-again>Другой способ</button>`;
  } else if (phase === 'wait') {
    body = `
      <div class="receipt-status">
        <div class="receipt-spinner" aria-hidden="true"></div>
        <p class="receipt-status__title">Проверяем чек</p>
        <p class="receipt-status__text">Обычно это занимает несколько секунд.</p>
      </div>`;
  } else if (phase === 'ok') {
    body = `
      <div class="receipt-status">
        <span class="receipt-status__mark">${ui.icon('check')}</span>
        <p class="receipt-status__title">Чек принят на проверку</p>
        <p class="receipt-status__text">Это ещё не начисление. Мы сверим покупку с условиями акции.</p>
      </div>
      <button class="btn btn--primary btn--block" type="button" data-done>Готово</button>`;
  } else {
    body = `
      <div class="receipt-status">
        <p class="receipt-status__title">Не удалось прочитать чек</p>
        <p class="receipt-status__text">Проверьте, что на снимке виден QR-код, и попробуйте ещё раз.</p>
      </div>
      <button class="btn btn--primary btn--block" type="button" data-again>Повторить</button>`;
  }

  container.innerHTML = `
    <div class="screen-head">
      <div class="screen-head__title">Добавить чек</div>
      <button class="icon-btn screen-head__close" type="button" data-close aria-label="Закрыть">${ui.icon('close')}</button>
    </div>
    <div class="receipt">${body}</div>`;
}

function finishLater(container, ctx) {
  const inst = ctx.instance;
  clearTimeout(inst.timer);
  inst.phase = 'wait';
  draw(container, ctx);
  inst.timer = setTimeout(() => {
    if (inst.closed) return;
    const dev = ctx.state.get('dev') || {};
    inst.phase = dev.receiptError ? 'error' : 'ok';
    draw(container, ctx);
  }, WAIT_MS);
}

export function render(container, params, ctx) {
  const inst = ctx.instance;
  inst.offerId = params.offerId;
  inst.phase = 'choose';
  inst.closed = false;
  draw(container, ctx);

  container.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) {
      ctx.router.back();
      return;
    }
    if (event.target.closest('[data-qr]')) {
      inst.phase = 'qr';
      draw(container, ctx);
      return;
    }
    if (event.target.closest('[data-file]')) {
      container.querySelector('.receipt__file')?.click();
      return;
    }
    if (event.target.closest('[data-scan]')) {
      finishLater(container, ctx);
      return;
    }
    if (event.target.closest('[data-again]')) {
      clearTimeout(inst.timer);
      inst.phase = 'choose';
      draw(container, ctx);
      return;
    }
    if (event.target.closest('[data-done]')) {
      ctx.router.back({ receipt: 'ok' });
    }
  });

  container.addEventListener('change', (event) => {
    const input = event.target;
    if (input.matches?.('input[type="file"]') && input.files?.[0]) finishLater(container, ctx);
  });
}

export function destroy(container, ctx) {
  ctx.instance.closed = true;
  clearTimeout(ctx.instance.timer);
}
