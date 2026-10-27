#!/usr/bin/env node
/**
 * Blog em Markdown para site estático (contrato do GDC).
 *
 * Lê content/blog/*.md e, para cada post publicado, gera a página no visual do
 * site (content/_gdc/post.html), atualiza listagens e o sitemap. Roda no deploy,
 * sobre uma cópia limpa do repositório; a pasta content/ não vai para o ar.
 *
 *   node content/_gdc/build.mjs [raiz-do-repo]
 *
 * Saída 0 = ok; 1 = erro (o deploy para e nada inválido chega ao ar).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "./marked.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] ?? path.join(here, "..", ".."));
const cfg = JSON.parse(fs.readFileSync(path.join(here, "config.json"), "utf8"));
const contentDir = path.join(root, "content", "blog");

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const FIELDS = new Set(["title", "description", "date", "slug", "tags", "cover", "coverAlt", "coverCredit", "coverCreditUrl", "author", "draft"]);

const fail = (msg) => {
  console.error(`gdc-blog: ${msg}`);
  process.exit(1);
};
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const write = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
const fill = (tpl, vars) =>
  tpl
    .replace(/\{\{\{(\w+)\}\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
    .replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? esc(vars[k]) : m));

/** Frontmatter no formato que o GDC grava: valores em JSON, tags em lista. */
function parseFrontmatter(file, text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) fail(`${file}: frontmatter ausente`);
  const data = {};
  let list = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const item = /^\s+-\s+(.*)$/.exec(raw);
    if (item && list) {
      data[list].push(JSON.parse(item[1]));
      continue;
    }
    const kv = /^([A-Za-z]+):\s*(.*)$/.exec(raw);
    if (!kv) fail(`${file}: linha inválida no frontmatter: ${raw}`);
    const [, key, value] = kv;
    if (!FIELDS.has(key)) fail(`${file}: campo desconhecido "${key}"`);
    if (key in data) fail(`${file}: campo repetido "${key}"`);
    if (value === "") {
      data[key] = [];
      list = key;
    } else {
      list = null;
      try {
        data[key] = JSON.parse(value);
      } catch {
        fail(`${file}: valor de "${key}" precisa estar entre aspas`);
      }
    }
  }
  return { data, body: m[2] };
}

function validate(file, d, body) {
  const errs = [];
  const str = (k, min, max) => {
    if (typeof d[k] !== "string" || d[k].trim().length < min || d[k].trim().length > max) errs.push(`${k}: ${min} a ${max} caracteres`);
  };
  str("title", 10, 110);
  str("description", 50, 160);
  if (!/^\d{4}-\d{2}-\d{2}/.test(d.date ?? "") || Number.isNaN(Date.parse(d.date))) errs.push("date inválida");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug ?? "") || d.slug.length > 80) errs.push("slug inválido");
  if (path.basename(file, ".md") !== d.slug) errs.push("nome do arquivo diferente do slug");
  if (!Array.isArray(d.tags) || d.tags.length < 1 || d.tags.length > 8) errs.push("tags: 1 a 8");
  if (typeof d.draft !== "boolean") errs.push("draft precisa ser true ou false");
  if (d.cover !== undefined) {
    if (!/^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\.(webp|jpg)$/.test(d.cover)) errs.push("cover deve ser /blog/<nome>.webp");
    else if (!fs.existsSync(path.join(root, cfg.assetsRoot ?? "", d.cover))) errs.push(`cover ${d.cover} não existe`);
    if (!d.coverAlt) errs.push("coverAlt obrigatório quando há cover");
  }
  if (d.coverCreditUrl !== undefined && !/^https:\/\//.test(d.coverCreditUrl)) errs.push("coverCreditUrl deve ser https://");
  for (const t of marked.lexer(body)) {
    if (t.type === "html") errs.push("HTML cru não é permitido");
    if (t.type === "heading" && t.depth === 1) errs.push("não use # (H1) no corpo");
  }
  const walk = (tokens) => {
    for (const t of tokens ?? []) {
      if (t.type === "html") errs.push("HTML cru não é permitido");
      if (t.type === "image") errs.push("imagem no corpo não é aceita");
      if (t.type === "link" && !/^(https:\/\/|\/(?!\/)|#|mailto:|tel:)/.test(t.href)) errs.push(`link não permitido: ${t.href}`);
      walk(t.tokens);
      if (t.items) t.items.forEach((i) => walk(i.tokens));
      if (t.rows) t.rows.flat().forEach((c) => walk(c.tokens));
      if (t.header) t.header.forEach((c) => walk(c.tokens));
    }
  };
  walk(marked.lexer(body));
  if (errs.length) fail(`${file}:\n  - ${[...new Set(errs)].join("\n  - ")}`);
}

marked.use({ gfm: true });

/** Estilo mínimo do corpo: o CSS de alguns sites zera listas e tabelas. */
const BODY_CSS =
  ".gdc-post ul{list-style:disc;padding-left:1.4em;margin:1em 0}.gdc-post ol{list-style:decimal;padding-left:1.4em;margin:1em 0}" +
  ".gdc-post li{margin:.35em 0}.gdc-post table{border-collapse:collapse;width:100%;margin:1.2em 0;display:block;overflow-x:auto}" +
  ".gdc-post th,.gdc-post td{border:1px solid rgba(127,127,127,.35);padding:.55em .8em;text-align:left;vertical-align:top}" +
  ".gdc-post p{margin:0 0 1em}.gdc-post h2,.gdc-post h3{margin:1.4em 0 .5em}.gdc-post blockquote{border-left:3px solid currentColor;margin:1.2em 0;padding-left:1em;opacity:.85}";

function renderBody(md) {
  return `<style>${cfg.bodyCss ?? BODY_CSS}</style>
<div class="gdc-post">
` + renderInner(md) + "</div>";
}

/** Markdown → HTML; links externos abrem em nova aba. */
function renderInner(md) {
  return marked
    .parse(md)
    .replace(/<a href="(https:\/\/[^"]+)"/g, (m, href) =>
      href.startsWith(cfg.siteUrl) ? m : `<a href="${href}" target="_blank" rel="noopener noreferrer"`,
    );
}

function words(md) {
  return md.replace(/[#*_>`|\-\[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
}

function dates(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return {
    dateBr: `${d} ${MESES[m - 1].slice(0, 3)}. ${y}`,
    dateLong: `${d} de ${MESES[m - 1]} de ${y}`,
  };
}

function loadPosts() {
  if (!fs.existsSync(contentDir)) return [];
  const posts = [];
  for (const name of fs.readdirSync(contentDir).sort()) {
    if (!name.endsWith(".md")) {
      if (!name.startsWith(".")) fail(`content/blog/${name}: só arquivos .md`);
      continue;
    }
    const file = `content/blog/${name}`;
    const { data, body } = parseFrontmatter(file, read(file));
    validate(file, data, body);
    if (data.draft) continue;
    posts.push({ ...data, body });
  }
  const titles = new Set();
  for (const p of posts) {
    const t = p.title.trim().toLowerCase();
    if (titles.has(t)) fail(`título repetido: ${p.title}`);
    titles.add(t);
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

function varsFor(p) {
  const url = cfg.postUrl.replace("{slug}", p.slug);
  const image = p.cover ? cfg.siteUrl + p.cover : cfg.defaultImage;
  const { dateBr, dateLong } = dates(p.date);
  const date = p.date.slice(0, 10);
  const credit = p.coverCredit
    ? `<p class="img-credit"${cfg.creditStyle ? ` style="${cfg.creditStyle}"` : ""}><small>Imagem: ${
        p.coverCreditUrl ? `<a href="${esc(p.coverCreditUrl)}" target="_blank" rel="noopener">${esc(p.coverCredit)}</a>` : esc(p.coverCredit)
      }</small></p>`
    : "";
  const coverSrc = p.cover ? (cfg.imagePrefix ?? "") + p.cover : "";
  const figure = p.cover
    ? fill(cfg.figure, { src: coverSrc, alt: p.coverAlt }).replace("{{{credit}}}", credit)
    : "";
  const crumbs = [{ name: "Início", item: cfg.siteUrl + "/" }];
  if (cfg.blogIndexUrl) crumbs.push({ name: "Blog", item: cfg.blogIndexUrl });
  crumbs.push({ name: p.title });
  const jsonld = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      image,
      datePublished: date,
      dateModified: date,
      author: { "@type": "Person", name: p.author || cfg.author, url: cfg.siteUrl + "/" },
      publisher: { "@type": "Organization", name: cfg.brand, url: cfg.siteUrl + "/" },
      mainEntityOfPage: url,
      inLanguage: "pt-BR",
      keywords: p.tags.join(", "),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })),
    },
  ]
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`)
    .join("\n");
  const category = p.tags[0].charAt(0).toUpperCase() + p.tags[0].slice(1);
  return {
    title: p.title,
    titleUrl: encodeURIComponent(p.title),
    description: p.description,
    slug: p.slug,
    url,
    href: cfg.listHref ? cfg.listHref.replace("{slug}", p.slug) : url,
    date,
    dateBr,
    dateLong,
    image,
    coverSrc,
    coverAlt: p.coverAlt ?? "",
    category,
    keywords: p.tags.join(", "),
    readingTime: `${Math.max(1, Math.round(words(p.body) / 200))} min`,
    author: p.author || cfg.author,
    figure,
    jsonld,
    body: renderBody(p.body),
  };
}

function addToSitemap(file, entries) {
  let xml = read(file);
  const add = entries
    .filter((e) => !xml.includes(`<loc>${e.url}</loc>`))
    .map((e) => `  <url>\n    <loc>${e.url}</loc>\n    <lastmod>${e.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`)
    .join("");
  if (!add) return;
  if (!xml.includes("</urlset>")) fail(`${file}: </urlset> não encontrado`);
  xml = xml.replace("</urlset>", add + "</urlset>");
  write(file, xml);
}

function listings(all) {
  for (const l of cfg.listings ?? []) {
    if (l.type === "postsJson") {
      const list = JSON.parse(read(l.file));
      const slugs = new Set(all.map((v) => v.slug));
      const rest = list.filter((x) => !slugs.has(x.slug));
      const add = all.map((v) => ({ slug: v.slug, title: v.title, date: v.date, excerpt: v.description, category: v.category, image: v.coverSrc ? v.coverSrc.replace(/^\.\.?\//, "/") : l.defaultImage }));
      const merged = [...add, ...rest].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      write(l.file, JSON.stringify(merged, null, 2) + "\n");
    } else if (l.type === "insert") {
      let text = read(l.file);
      if (!text.includes(l.marker)) fail(`${l.file}: marcador ${JSON.stringify(l.marker)} não encontrado`);
      const items = all.filter((v) => !text.includes(v.href)).map((v) => fill(l.item, v)).join("");
      text = text.replace(l.marker, l.marker + items);
      write(l.file, text);
    } else if (l.type === "indexPage") {
      // Página do blog no mesmo layout do post: lista os posts do GDC e os feitos à mão (extraPosts).
      const extra = (l.extraPosts ?? []).map((e) => ({ ...e, ...dates(e.date) }));
      const entries = [...all, ...extra].sort((a, b) => b.date.localeCompare(a.date));
      const items = `<style>.gdc-blog-list{list-style:none;padding:0;display:grid;gap:18px;margin:1.5em 0}.gdc-blog-list li{line-height:1.5}</style>
<ul class="gdc-blog-list">\n${entries.map((v) => fill(l.item, v)).join("\n")}\n</ul>`;
      const latest = entries[0] ?? { date: new Date().toISOString().slice(0, 10) };
      const page = fill(read(cfg.layout ?? "content/_gdc/post.html"), {
        ...latest,
        ...dates(latest.date),
        title: l.title,
        titleUrl: encodeURIComponent(l.title),
        description: l.description,
        url: l.url,
        image: cfg.defaultImage,
        category: l.category ?? "Blog",
        keywords: "",
        readingTime: "",
        figure: "",
        jsonld: "",
        body: (l.style ? `<style>${l.style}</style>\n` : "") + items,
      });
      // Índice num nível acima do post (ex.: /blog/ e /blog/<slug>/): corrige os caminhos relativos.
      write(l.file, l.relFix ? page.split(l.relFix[0]).join(l.relFix[1]) : page);
      if (cfg.sitemap) addToSitemap(cfg.sitemap, [{ url: l.url, date: latest.date }]);
    } else fail(`listagem desconhecida: ${l.type}`);
  }
}

// Rodar de novo na mesma pasta (ex.: npm run deploy local) apaga o que a rodada anterior gerou.
const manifest = path.join(here, ".generated.json");
if (fs.existsSync(manifest)) {
  for (const rel of JSON.parse(fs.readFileSync(manifest, "utf8"))) fs.rmSync(path.join(root, rel), { force: true });
}
const posts = loadPosts();
const tpl = read(cfg.layout ?? "content/_gdc/post.html");
const all = [];
for (const p of posts) {
  const out = cfg.postFile.replace("{slug}", p.slug);
  if (fs.existsSync(path.join(root, out))) fail(`${out} já existe no repositório (slug repetido)`);
  const v = varsFor(p);
  write(out, fill(tpl, v));
  all.push(v);
  console.log(`ok  ${p.slug}  ${v.date}  ${out}`);
}
fs.writeFileSync(manifest, JSON.stringify(posts.map((p) => cfg.postFile.replace("{slug}", p.slug))));
if (all.length || cfg.alwaysListings) listings(all);
if (all.length && cfg.sitemap) addToSitemap(cfg.sitemap, all);
if (cfg.urlsFile) write(cfg.urlsFile, JSON.stringify(all.map((v) => v.url.replace(cfg.siteUrl + "/", "")), null, 2) + "\n");
console.log(`${all.length} post(s) gerado(s).`);
