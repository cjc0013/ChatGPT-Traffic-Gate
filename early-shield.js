// content/early-shield.js — document_start CSS shield (auto-unshields safely)

(() => {
  try {
    const style = document.createElement('style');
    style.id = 'tg-early-shield';
    style.textContent = `
      html.tg-shield [data-testid^="conversation-turn-"] { display: none !important; }
      html.tg-shield [data-testid="conversation-turns"] { visibility: hidden !important; }
    `;
    document.documentElement.classList.add('tg-shield');
    document.documentElement.appendChild(style);

    // Safety valve: auto-unshield after 2.5s even if no trim fired
    setTimeout(() => {
      try {
        document.documentElement.classList.remove('tg-shield');
        style.remove();
      } catch {}
    }, 2500);

    // Preferred path: listen for explicit unshield event
    window.addEventListener('tg-unshield', () => {
      try {
        document.documentElement.classList.remove('tg-shield');
        style.remove();
      } catch {}
    }, { once: true });
  } catch {}
})();
