// content/autopilot.js — Self-tuning; enables reloads only if repeated disconnects

(function () {
  'use strict';
  const api = (typeof browser !== 'undefined') ? browser : chrome;

  const stats = { cancels: 0, disconnects: 0, longtasks: 0, lastTurnCount: 0, windowStart: Date.now() };
  const cfg = { topPx: 180, minTopPx: 80, softcapKeep: 60, minKeep: 30 };

  Object.defineProperty(window, '__tgTelemetry', {
    value: function (event, data) {
      try {
        if (event === 'historyCancel') stats.cancels++;
        else if (event === 'disconnect') stats.disconnects++;
        else if (event === 'turnCount' && typeof data?.count === 'number') stats.lastTurnCount = data.count;
      } catch {}
    },
    writable: false, configurable: false, enumerable: false
  });

  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.duration >= 200) stats.longtasks++;
    });
    po.observe({ entryTypes: ['longtask'] });
  } catch {}

  function updateIntent() {
    const sc = document.scrollingElement || document.documentElement;
    const nearTop = (sc.scrollTop < cfg.topPx);
    try { window.__chatTrafficGate?.setIntent(!!nearTop); } catch {}
    api.runtime.sendMessage({ type: 'historyIntent', value: !!nearTop }).catch(()=>{});
  }
  window.addEventListener('scroll', () => updateIntent(), { passive: true });
  setInterval(updateIntent, 2000);
  updateIntent();

  async function tune() {
    const cancels = stats.cancels, disc = stats.disconnects, jank = stats.longtasks, turns = stats.lastTurnCount;
    stats.cancels = stats.disconnects = stats.longtasks = 0; stats.windowStart = Date.now();

    if (disc >= 2) {
      try { window.__chatKeepalive?.setMinutes(3); } catch {}
      try { window.__chatKeepalive?.setAutoReconnect(true); } catch {}
      try { window.__chatKeepalive?.setAllowReloads(true); } catch {}
    }
    if (jank >= 4 || (turns && turns > cfg.softcapKeep + 10)) {
      cfg.softcapKeep = Math.max(cfg.minKeep, (cfg.softcapKeep || 60) - 10);
      try { window.__chatSoftCap?.setConfig({ enabled: true, keep: cfg.softcapKeep }); } catch {}
    }
    if (cancels >= 20) cfg.topPx = Math.max(cfg.minTopPx, cfg.topPx - 20);

    if (disc === 0 && jank <= 1 && cancels < 5) {
      if ((cfg.softcapKeep || 60) < 60) {
        cfg.softcapKeep = Math.min(60, (cfg.softcapKeep || 60) + 10);
        try { window.__chatSoftCap?.setConfig({ enabled: true, keep: cfg.softcapKeep }); } catch {}
      }
      if (cfg.topPx < 180) cfg.topPx += 10;
      try { window.__chatKeepalive?.setMinutes(4); } catch {}
      try { window.__chatKeepalive?.setAllowReloads(false); } catch {}
    }
  }
  setInterval(tune, 40000);
  setTimeout(tune, 5000);
})();
