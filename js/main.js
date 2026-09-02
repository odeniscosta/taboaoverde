// ============================================================
// TABOÃO VERDE — Interações principais
// ============================================================

// Fallback: config.js pode não estar disponível no servidor (é gitignored).
// Garante que CONFIG exista com valores padrão para o script não abortar.
if (typeof CONFIG === 'undefined') {
  window.CONFIG = {
    webhookUrl:   '',
    whatsapp:     '5511966067829',
    gtmId:        '',
    metaPixelId:  '',
  };
}

const WA = CONFIG.whatsapp;

function trackEvent(name, params = {}) {
  if (typeof window.gtag === 'function') window.gtag('event', name, params);
}

window.trackTVEvent = trackEvent;

// ── Ano no footer ──
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── Header scroll ──
const header = document.getElementById('siteHeader');
const scrollSentinel = document.getElementById('scrollSentinel');
if (header && scrollSentinel && 'IntersectionObserver' in window) {
  const headerObserver = new IntersectionObserver(([entry]) => {
    header.classList.toggle('is-scrolled', !entry.isIntersecting);
  });
  headerObserver.observe(scrollSentinel);
}

// ── Menu mobile ──
const navToggle = document.getElementById('navToggle');
const mainNav   = document.getElementById('mainNav');

function closeNav() {
  mainNav.classList.remove('is-open');
  document.body.classList.remove('nav-open');
  navToggle.setAttribute('aria-expanded', 'false');
}

navToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('is-open');
  document.body.classList.toggle('nav-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
});

mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));

document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
  link.addEventListener('click', () => {
    const location = link.closest('header') ? 'header'
      : link.closest('#calculadora') ? 'calculadora'
      : link.closest('footer') ? 'footer'
      : link.classList.contains('whatsapp-float') ? 'floating'
      : 'content';
    trackEvent('whatsapp_click', { location });
  });
});

// ── Tabs "Para você" ──
const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('is-active'));
    tabPanels.forEach(p => p.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.getElementById('tab-' + target)?.classList.add('is-active');
  });
});

// ── FAQ accordion ──
document.querySelectorAll('.faq-item').forEach(item => {
  const btn    = item.querySelector('.faq-q');
  const answer = item.querySelector('.faq-a');

  btn.addEventListener('click', () => {
    const open = item.classList.contains('is-open');

    // fecha todos
    document.querySelectorAll('.faq-item.is-open').forEach(o => {
      if (o !== item) {
        o.classList.remove('is-open');
        o.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
        o.querySelector('.faq-a').style.maxHeight = null;
      }
    });

    item.classList.toggle('is-open', !open);
    btn.setAttribute('aria-expanded', String(!open));
    answer.style.maxHeight = !open ? answer.scrollHeight + 'px' : null;
  });
});

// ── Scroll reveal ──
// Sinaliza ao CSS que o JS está ativo — só então .reveal fica opacity:0
document.body.classList.add('js-ready');

if ('IntersectionObserver' in window) {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
}

// ── Formulário de contato → WhatsApp + n8n ──
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome     = document.getElementById('c-nome')?.value.trim();
    const telefone = document.getElementById('c-telefone')?.value.trim();
    const tipo     = document.getElementById('c-tipo')?.value;
    const msg      = document.getElementById('c-mensagem')?.value.trim();
    const consent  = document.getElementById('c-consent')?.checked;

    if (!nome || !telefone || !consent) return;

    const payload = {
      nome,
      whatsapp:          telefone,
      tipo_cliente:      tipo,
      valor_conta:       null,
      solucao_interesse: null,
      origem:            'formulario_contato',
      consentimento:     consent,
      created_at:        new Date().toISOString(),
    };

    // Envia ao n8n (sem bloquear o fluxo)
    if (CONFIG.webhookUrl) {
      fetch(CONFIG.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
    trackEvent('contact_form_submit', { client_type: tipo || 'not_selected' });

    // Abre WhatsApp com mensagem pronta
    const texto = [
      `Olá, Taboão Verde! Meu nome é ${nome}.`,
      tipo ? `Sou do segmento: ${tipo}.` : null,
      msg   ? `Mensagem: ${msg}` : null,
    ].filter(Boolean).join(' ');

    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    trackEvent('whatsapp_open', { source: 'contact_form' });
  });
}

// ── GTM / Meta Pixel (se configurados) ──
if (CONFIG.gtmId) {
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
  var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
  j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
  f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer', CONFIG.gtmId);
}

if (CONFIG.metaPixelId) {
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', CONFIG.metaPixelId);
  fbq('track', 'PageView');
}
