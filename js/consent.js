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
  function renderBanner() {
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
