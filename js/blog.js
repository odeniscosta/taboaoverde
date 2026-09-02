// ============================================================
// TABOÃO VERDE — Blog: listagem e "Últimas do Blog" na home
// ============================================================
(function () {
  'use strict';

  const CAT_CLASS = {
    'Energia Solar':    'energia-solar',
    'Sustentabilidade': 'sustentabilidade',
    'Mercado & Setor':  'mercado',
    'Economia':         'economia',
  };

  const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const DEFAULT_IMAGE_WIDTH = 800;
  const DEFAULT_IMAGE_HEIGHT = 450;
  const IMAGE_DIMENSIONS = {
    '/images/blog/energia-solar-para-igrejas.jpg': [1200, 675],
  };

  function formatDate(str) {
    const [y, m, d] = str.split('-');
    return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}. ${y}`;
  }

  function imgHTML(post) {
    if (post.image) {
      const [width, height] = IMAGE_DIMENSIONS[post.image] || [DEFAULT_IMAGE_WIDTH, DEFAULT_IMAGE_HEIGHT];
      return `<img class="blog-card-img" src="${post.image}" alt="${post.title}" loading="lazy" width="${width}" height="${height}">`;
    }
    return `<div class="blog-card-img-placeholder" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M17 7l-1.4 1.4M6.9 17l-1.3 1.3" stroke-linecap="round"/>
      </svg>
    </div>`;
  }

  function cardHTML(post, prefix) {
    const cat = CAT_CLASS[post.category] || 'energia-solar';
    return `
<a class="blog-card reveal" href="${prefix}${post.slug}.html">
  ${imgHTML(post)}
  <div class="blog-card-body">
    <div class="blog-card-meta">
      <span class="badge badge--${cat}">${post.category}</span>
      <span class="blog-card-date">${formatDate(post.date)}</span>
    </div>
    <div class="blog-card-title">${post.title}</div>
    <p class="blog-card-excerpt">${post.excerpt}</p>
    <span class="blog-card-link">Ler artigo →</span>
  </div>
</a>`;
  }

  function observeReveal(container) {
    if (!('IntersectionObserver' in window)) {
      container.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
      return;
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    container.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  // ── Página de listagem do blog ──
  const blogGrid = document.getElementById('blogGrid');
  if (blogGrid) {
    let allPosts = [];
    let activeFilter = 'todos';

    function render(posts) {
      if (!posts.length) {
        blogGrid.innerHTML = '<div class="blog-empty">Nenhum artigo nesta categoria ainda.</div>';
        return;
      }
      blogGrid.innerHTML = posts.map(p => cardHTML(p, '')).join('');
      observeReveal(blogGrid);
    }

    document.querySelectorAll('.blog-filter-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.blog-filter-btn').forEach(b => b.classList.remove('is-active'));
        this.classList.add('is-active');
        activeFilter = this.dataset.cat;
        const filtered = activeFilter === 'todos'
          ? allPosts
          : allPosts.filter(p => p.category === activeFilter);
        render(filtered);
      });
    });

    fetch('posts.json')
      .then(r => r.json())
      .then(posts => {
        allPosts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        render(allPosts);
      })
      .catch(() => {
        blogGrid.innerHTML = '<div class="blog-empty">Erro ao carregar artigos. Tente novamente mais tarde.</div>';
      });
  }

  // ── Seção "Últimas do Blog" na homepage ──
  const latestGrid = document.getElementById('latestBlogGrid');
  if (latestGrid) {
    fetch('blog/posts.json')
      .then(r => r.json())
      .then(posts => {
        const latest = posts.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
        if (!latest.length) {
          const section = document.getElementById('latestBlogSection');
          if (section) section.style.display = 'none';
          return;
        }
        latestGrid.innerHTML = latest.map(p => cardHTML(p, 'blog/')).join('');
        observeReveal(latestGrid);
      })
      .catch(() => {
        const section = document.getElementById('latestBlogSection');
        if (section) section.style.display = 'none';
      });
  }

})();
