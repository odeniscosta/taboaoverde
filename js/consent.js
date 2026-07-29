(() => {
  'use strict';

  const storageKey = 'privacy-consent-v1';
  const script = document.currentScript;
  const gaId = script?.dataset.gaId || '';
  const privacyUrl = script?.dataset.privacyUrl || 'privacidade.html';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 });
  let googleLoaded = false;
  function loadGoogleTag() {
    if (!gaId || googleLoaded) return;
    googleLoaded = true;
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(tag);
    window.gtag('js', new Date());
    window.gtag('config', gaId, { anonymize_ip: true });
  }
  function save(choice) { try { localStorage.setItem(storageKey, choice); } catch (_) {} }
  function grant() {
    window.gtag('consent', 'update', { ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
    save('granted');
    loadGoogleTag();
  }
  function deny() {
    window.gtag('consent', 'update', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    save('denied');
  }
  function ensureStyles() {
    if (document.getElementById('consent-styles')) return;
    const style = document.createElement('style');
    style.id = 'consent-styles';
    style.textContent = '.consent-banner{position:fixed;z-index:10000;right:20px;bottom:20px;left:20px;display:flex;align-items:center;justify-content:space-between;gap:24px;max-width:960px;margin:auto;padding:18px 20px;color:#f7faf8;background:#10251b;border:1px solid rgba(255,255,255,.2);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.3);font-family:system-ui,sans-serif}.consent-banner strong{display:block;margin-bottom:4px}.consent-banner p{margin:0;color:#d7e3dc;font-size:14px;line-height:1.5}.consent-banner a{color:#fff;text-decoration:underline}.consent-actions{display:flex;gap:10px;flex:0 0 auto}.consent-actions button{min-height:44px;padding:10px 16px;border:1px solid #fff;border-radius:8px;font:inherit;font-weight:700;cursor:pointer}.consent-reject{color:#fff;background:transparent}.consent-accept{color:#10251b;background:#fff}.consent-settings{position:fixed;z-index:9999;left:12px;bottom:12px;padding:8px 12px;color:#fff;background:#10251b;border:1px solid rgba(255,255,255,.45);border-radius:999px;font:12px system-ui,sans-serif;cursor:pointer}@media(max-width:680px){.consent-banner{align-items:stretch;flex-direction:column;gap:14px}.consent-actions{display:grid;grid-template-columns:1fr 1fr}}';
    document.head.appendChild(style);
  }
  function renderBanner() {
    ensureStyles();
    const banner = document.createElement('section');
    banner.className = 'consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Preferências de privacidade');
    banner.innerHTML = `<div><strong>Sua privacidade importa</strong><p>Usamos cookies opcionais para medir a navegação e melhorar este site. Você pode aceitar ou recusar. <a href="${privacyUrl}">Saiba mais</a>.</p></div><div class="consent-actions"><button type="button" class="consent-reject">Recusar</button><button type="button" class="consent-accept">Aceitar</button></div>`;
    document.body.appendChild(banner);
    const close = () => { banner.remove(); renderSettings(); };
    banner.querySelector('.consent-accept').addEventListener('click', () => { grant(); close(); });
    banner.querySelector('.consent-reject').addEventListener('click', () => { deny(); close(); });
  }
  function renderSettings() {
    ensureStyles();
    if (document.querySelector('.consent-settings')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'consent-settings';
    button.textContent = 'Cookies';
    button.addEventListener('click', () => { button.remove(); renderBanner(); });
    document.body.appendChild(button);
  }
  let choice = null;
  try { choice = localStorage.getItem(storageKey); } catch (_) {}
  if (choice === 'granted') { grant(); renderSettings(); }
  else if (choice === 'denied') { deny(); renderSettings(); }
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderBanner);
  else renderBanner();
})();
