// content/dom-softcap.js — batched trims + safe unshield

(function () {
  'use strict';
  const SELECTOR_TURN = '[data-testid^="conversation-turn-"]';
  const state = { enabled: true, keep: 60, container: null, observer: null, firstDone: false };

  const tlog = (...args) => { try { window.__tgTelemetry?.apply(null, args); } catch {} };

  Object.defineProperty(window, '__chatSoftCap', {
    value: {
      setConfig: (cfg) => {
        if (!cfg || typeof cfg !== 'object') return;
        if (typeof cfg.enabled === 'boolean') state.enabled = cfg.enabled;
        if (typeof cfg.keep === 'number' && isFinite(cfg.keep)) state.keep = Math.max(20, Math.min(300, Math.floor(cfg.keep)));
        schedule(30);
      }
    },
    writable: false, configurable: false, enumerable: false
  });

  function findContainer() {
    const first = document.querySelector(SELECTOR_TURN);
    if (!first) return null;
    let p = first.parentElement;
    while (p && p !== document.body) {
      const kids = Array.from(p.children).filter((el) => el.nodeType === 1);
      if (kids.length && kids.every((el) => el.matches(SELECTOR_TURN))) return p;
      p = p.parentElement;
    }
    return first.parentElement || null;
  }
  function isPure(node) {
    if (!node) return false;
    const kids = Array.from(node.children).filter((el) => el.nodeType === 1);
    return kids.length && kids.every((el) => el.matches(SELECTOR_TURN));
  }
  function nodes() {
    if (!state.container) return [];
    return Array.from(state.container.querySelectorAll(SELECTOR_TURN));
  }

  function trim() {
    if (!state.enabled || !state.container) return;
    const list = nodes();
    const tot = list.length;
    tlog('turnCount', { count: tot, keep: state.keep });
    const extra = tot - state.keep;
    if (extra > 0) {
      const cutoff = tot - state.keep;
      const keep = list.slice(cutoff);
      const old = state.container.style.display;
      state.container.style.display = 'none';
      if (isPure(state.container)) {
        state.container.replaceChildren(...keep);
      } else {
        for (let i = 0; i < cutoff; i++) list[i].remove();
      }
      state.container.style.display = old;
      tlog('trim', { removed: cutoff, kept: state.keep });
    }
    if (!state.firstDone) {
      state.firstDone = true;
      try { window.dispatchEvent(new Event('tg-unshield')); } catch {}
    }
  }

  let t = null;
  function schedule(ms = 0) { if (t) clearTimeout(t); t = setTimeout(trim, ms); }

  function watch() {
    const c = findContainer();
    if (!c) return;
    if (state.container !== c) {
      if (state.observer) try { state.observer.disconnect(); } catch {}
      state.container = c;
      state.observer = new MutationObserver(() => schedule(20));
      state.observer.observe(state.container, { childList: true });
      schedule(50);
    }
  }

  function heartbeat() { watch(); schedule(0); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { watch(); schedule(60); setInterval(heartbeat, 1000); }, { once: true });
  } else {
    watch(); schedule(60); setInterval(heartbeat, 1000);
  }
})();
