// content/traffic-ui.js — minimal pill

(function () {
  const api = (typeof browser !== 'undefined') ? browser : chrome;
  let status = { blockHistory: true, intent: false, allowUntil: 0 };
  let pill, hideTimer;

  function ensurePill() {
    if (pill && document.body.contains(pill)) return;
    pill = document.createElement('div');
    Object.assign(pill.style, {
      position: 'fixed', right: '10px', bottom: '52px', zIndex: 2147483647,
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial',
      fontSize: '12px', background: 'rgba(18,18,18,0.9)', color: '#fff',
      padding: '8px 10px', borderRadius: '12px', boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', gap: '10px', userSelect: 'none', opacity: '0.85'
    });

    const led = document.createElement('span');
    led.textContent = '🤖 Auto';
    led.title = 'AutoPilot active';

    const gate = document.createElement('button');
    gate.textContent = '🚦 On';
    styleBtn(gate);
    gate.title = 'Toggle network gate (AutoPilot manages this)';
    gate.addEventListener('click', async () => {
      status.blockHistory = !status.blockHistory;
      try { window.__chatTrafficGate?.setEnabled(status.blockHistory); } catch {}
      try { await api.storage.local.set({ blockHistory: status.blockHistory }); } catch {}
      try { await api.runtime.sendMessage({ type: "toggleBlockHistory", value: status.blockHistory }); } catch {}
      render();
    });

    const allow10 = document.createElement('button');
    styleBtn(allow10); allow10.textContent = 'Allow 10s';
    allow10.title = 'Temporarily allow history for 10 seconds (this tab)';
    allow10.addEventListener('click', async () => {
      try { window.__chatTrafficGate?.allowForMs(10000); } catch {}
      try { await api.runtime.sendMessage({ type: 'allowHistoryForMs', ms: 10000 }); } catch {}
      render();
    });

    pill.append(led, gate, allow10);
    document.documentElement.appendChild(pill);

    scheduleHide();
    pill.addEventListener('mouseenter', () => { clearTimeout(hideTimer); pill.style.opacity = '1'; });
    pill.addEventListener('mouseleave', scheduleHide);
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { pill && (pill.style.opacity = '0.35'); }, 5000);
  }

  function styleBtn(b) {
    Object.assign(b.style, { padding: '4px 8px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2a', color: '#fff', cursor: 'pointer' });
    b.onmouseenter = () => b.style.background = '#333';
    b.onmouseleave = () => b.style.background = '#2a2a2a';
  }

  function render() {
    if (!pill) return;
    const now = Date.now();
    const inAllow = now < (status.allowUntil || 0);
    gate.textContent = status.blockHistory ? '🚦 On' : '🚦 Off';
    pill.title = inAllow ? 'History temporarily allowed (timer)' : 'History blocked by default';
  }

  async function init() {
    ensurePill();
    try {
      const resp = await api.runtime.sendMessage({ type: "requestStatus" });
      if (resp) { status.blockHistory = !!resp.blockHistory; status.intent = !!resp.intent; status.allowUntil = Number(resp.allowUntil || 0); }
    } catch {}
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
