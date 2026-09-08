// Pre-renders static HTML for every published article so search engines
// and AI crawlers (which generally do not execute the Supabase fetch/JS
// that powers the live /articles/ pages) can see real, per-article
// content, meta tags, and structured data.
//
// Run manually with: npm install && npm run generate:articles
// Runs automatically via .github/workflows/generate-articles.yml

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const SITE_URL = 'https://teredatrades.com';

// Public Supabase project + publishable key — these are already exposed
// client-side in articles/index.html and articles/article.html, so it's
// safe to read them here too (RLS restricts this key to published rows).
const SUPABASE_URL = 'https://mvmosynzbawxeuqfyitj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gfFVcf_Tf4cwsUY8DiUZSw_fF-wtwz';

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s = '') {
  return escapeHtml(s);
}

async function fetchArticles() {
  const url =
    `${SUPABASE_URL}/rest/v1/articles` +
    `?select=slug,title,excerpt,youtube_id,published_at,tags,body` +
    `&status=eq.published&visibility=in.(website,both)` +
    `&order=published_at.desc`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected Supabase response shape');
  }
  return data;
}

function renderBody(markdown) {
  const rawHtml = marked.parse(markdown || '');
  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'loading'],
      a: ['href', 'name', 'target', 'rel'],
    },
  });
}

function formatDateHuman(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function articleHtml(article) {
  const {
    slug,
    title,
    excerpt,
    youtube_id: youtubeId,
    published_at: publishedAt,
    tags,
    body,
  } = article;

  const pageTitle = `${escapeHtml(title)} | Tereda Trades`;
  const description = escapeAttr(excerpt || title || 'Trading breakdowns and video walkthroughs from Tereda Trades.');
  const canonical = `${SITE_URL}/articles/${slug}.html`;
  const dateHuman = formatDateHuman(publishedAt);
  const dateIso = publishedAt ? new Date(publishedAt).toISOString() : '';

  const videoHtml = youtubeId
    ? `<div class="yt-embed"><iframe src="https://www.youtube.com/embed/${escapeAttr(youtubeId)}" title="${escapeAttr(title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
    : '';

  const tagsHtml =
    Array.isArray(tags) && tags.length
      ? `<div class="tags">${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

  const bodyHtml = renderBody(body);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': youtubeId ? 'VideoObject' : 'Article',
  };

  // Keep it simple and always emit a valid Article (VideoObject requires
  // fields — like uploadDate + thumbnailUrl — we can't reliably fill),
  // and separately note the embedded video via a mention, not a full
  // VideoObject claim.
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: excerpt || title,
    image: `${SITE_URL}/assets/BANNER.png`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    datePublished: dateIso || undefined,
    dateModified: dateIso || undefined,
    author: { '@type': 'EducationalOrganization', name: 'Tereda Trades' },
    publisher: {
      '@type': 'EducationalOrganization',
      name: 'Tereda Trades',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/logo.png` },
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${pageTitle}</title>
<meta name="robots" content="index, follow" />
<meta name="description" content="${description}" />
<link rel="canonical" href="${canonical}" />

<meta property="og:title" content="${pageTitle}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${SITE_URL}/assets/BANNER.png" />
<meta property="og:url" content="${canonical}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Tereda Trades" />
${dateIso ? `<meta property="article:published_time" content="${dateIso}" />` : ''}

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${pageTitle}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${SITE_URL}/assets/BANNER.png" />

<script type="application/ld+json">${JSON.stringify(articleJsonLd, null, 2)}</script>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="icon" href="/assets/logo.png" type="image/png" />
<script data-goatcounter="https://teredatrades.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
<style>
  :root{
    --bg-color:#0B0E14; --bg-surface:#11151F; --bg-surface-alt:#141926;
    --text-main:#E7E9EE; --text-muted:#7B8298; --border-color:#232A3B; --border-soft:#1B2130;
    --accent:#D4A340; --teal:#4FB6A8;
  }
  *{box-sizing:border-box;} html,body{margin:0;padding:0;}
  body{background:var(--bg-color);color:var(--text-main);font-family:'Inter',-apple-system,sans-serif;line-height:1.65;}
  a{color:var(--accent);}
  .heading{font-family:'Space Grotesk',sans-serif;}
  .wrap{max-width:760px;margin:0 auto;padding:0 20px;}
  .topbar{border-bottom:1px solid var(--border-soft);padding:16px 0;margin-bottom:8px;}
  .topbar .wrap{display:flex;align-items:center;justify-content:space-between;}
  .brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:15px;text-decoration:none;color:var(--text-main);}
  .brand img{width:32px;height:32px;border-radius:6px;object-fit:cover;}
  .back{font-size:13px;color:var(--text-muted);}
  article{padding:36px 0 80px;}
  h1{font-size:clamp(26px,4vw,36px);font-weight:700;margin:0 0 10px;}
  .meta{color:var(--text-muted);font-size:13px;margin-bottom:24px;}
  .yt-embed{position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000;margin-bottom:28px;}
  .yt-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}
  .body-content h2{font-family:'Space Grotesk',sans-serif;font-size:22px;margin-top:32px;}
  .body-content h3{font-family:'Space Grotesk',sans-serif;font-size:18px;margin-top:26px;}
  .body-content p{margin:0 0 16px;color:#D3D6DE;}
  .body-content ul, .body-content ol{color:#D3D6DE;padding-left:22px;}
  .body-content code{background:var(--bg-surface-alt);padding:2px 6px;border-radius:4px;font-size:.9em;}
  .body-content pre{background:var(--bg-surface-alt);padding:14px;border-radius:8px;overflow-x:auto;}
  .body-content blockquote{border-left:3px solid var(--accent);margin:0 0 16px;padding:2px 0 2px 16px;color:var(--text-muted);}
  .tags{margin-top:32px;display:flex;gap:8px;flex-wrap:wrap;}
  .tag{background:var(--bg-surface);border:1px solid var(--border-soft);border-radius:999px;padding:4px 12px;font-size:12px;color:var(--text-muted);}
  footer{border-top:1px solid var(--border-soft);padding:24px 0;text-align:center;color:var(--text-muted);font-size:13px;}
</style>
</head>
<body>
  <header class="topbar">
    <div class="wrap">
      <a href="/" class="brand"><img src="/assets/logo.png" alt="Tereda Trades" /> Tereda Trades</a>
      <a href="/articles/" class="back">&larr; All articles</a>
    </div>
  </header>

  <div class="wrap">
    <article>
      <h1 class="heading">${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(dateHuman)}</div>
      ${videoHtml}
      <div class="body-content">${bodyHtml}</div>
      ${tagsHtml}
    </article>
  </div>

  <footer>&copy; 2026 Tereda Trades. <a href="/">Back to home</a></footer>
</body>
</html>
`;
}

function cardHtml(article) {
  const { slug, title, excerpt, youtube_id: youtubeId, published_at: publishedAt } = article;
  const dateHuman = publishedAt
    ? new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
  return `
    <a class="card" href="/articles/${escapeAttr(slug)}.html">
      <div class="card-title">${escapeHtml(title)}</div>
      ${excerpt ? `<p class="card-excerpt">${escapeHtml(excerpt)}</p>` : ''}
      <div class="card-meta">
        ${escapeHtml(dateHuman)}
        ${youtubeId ? '<span class="yt-tag">&#9654; Video</span>' : ''}
      </div>
    </a>`;
}

function indexHtml(articles) {
  const list = articles.length
    ? articles.map(cardHtml).join('\n')
    : '<p class="empty">No articles yet — check back soon.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="Trading breakdowns, market structure explainers, and video walkthroughs from Tereda Trades." />
<title>Articles | Tereda Trades</title>
<link rel="canonical" href="${SITE_URL}/articles/" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="Articles | Tereda Trades" />
<meta property="og:description" content="Trading breakdowns, market structure explainers, and video walkthroughs from Tereda Trades." />
<meta property="og:url" content="${SITE_URL}/articles/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Tereda Trades" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="icon" href="/assets/logo.png" type="image/png" />
<script data-goatcounter="https://teredatrades.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
<style>
  :root{
    --bg-color:#0B0E14; --bg-surface:#11151F; --bg-surface-alt:#141926;
    --text-main:#E7E9EE; --text-muted:#7B8298; --border-color:#232A3B; --border-soft:#1B2130;
    --accent:#D4A340; --accent-hover:#E3B65B; --accent-ink:#181205; --teal:#4FB6A8;
  }
  *{box-sizing:border-box;} html,body{margin:0;padding:0;}
  body{background:var(--bg-color);color:var(--text-main);font-family:'Inter',-apple-system,sans-serif;line-height:1.5;}
  a{color:inherit;text-decoration:none;}
  .heading{font-family:'Space Grotesk',sans-serif;}
  .wrap{max-width:900px;margin:0 auto;padding:0 20px;}
  .topbar{border-bottom:1px solid var(--border-soft);padding:16px 0;}
  .topbar .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;}
  .brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:15px;}
  .brand img{width:32px;height:32px;border-radius:6px;object-fit:cover;}
  .topbar nav a{font-size:13px;color:var(--text-muted);margin-left:18px;}
  .topbar nav a:hover{color:var(--text-main);}
  .hero{padding:44px 0 20px;}
  h1{font-size:clamp(26px,4vw,38px);font-weight:700;margin:0 0 8px;}
  .hero p{color:var(--text-muted);font-size:15px;margin:0;}
  .list{padding:24px 0 72px;display:flex;flex-direction:column;gap:16px;}
  .card{
    display:block;background:var(--bg-surface);border:1px solid var(--border-soft);
    border-radius:14px;padding:20px 22px;transition:border-color .15s;
  }
  .card:hover{border-color:var(--accent);}
  .card-title{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600;margin:0 0 6px;}
  .card-excerpt{color:var(--text-muted);font-size:14px;margin:0 0 10px;}
  .card-meta{font-size:12px;color:var(--teal);display:flex;align-items:center;gap:8px;}
  .yt-tag{background:rgba(212,87,74,.15);color:#E27568;padding:2px 8px;border-radius:999px;font-weight:600;font-size:11px;}
  .empty{color:var(--text-muted);padding:40px 0;text-align:center;}
  footer{border-top:1px solid var(--border-soft);padding:24px 0;text-align:center;color:var(--text-muted);font-size:13px;}
</style>
</head>
<body>
  <header class="topbar">
    <div class="wrap">
      <a href="/" class="brand"><img src="/assets/logo.png" alt="Tereda Trades" /> Tereda Trades</a>
      <nav>
        <a href="/">Home</a>
        <a href="/market-pulse/">Market Pulse</a>
        <a href="/articles/">Articles</a>
      </nav>
    </div>
  </header>

  <div class="wrap">
    <div class="hero">
      <h1 class="heading">Articles</h1>
      <p>Trade breakdowns, market structure explainers, and video walkthroughs.</p>
    </div>
    <div class="list" id="list">${list}</div>
  </div>

  <footer>&copy; 2026 Tereda Trades. <a href="/">Back to home</a></footer>
</body>
</html>
`;
}

// Redirect page kept at the old ?slug= URL shape so any existing shared
// links (social posts, bookmarks) land on the new static page instead of
// a blank "Loading…" shell or a 404.
function articleRedirectHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Article | Tereda Trades</title>
<meta name="robots" content="noindex, follow" />
<script>
  (function () {
    var params = new URLSearchParams(location.search);
    var slug = params.get('slug');
    if (slug) {
      location.replace('/articles/' + encodeURIComponent(slug) + '.html');
    } else {
      location.replace('/articles/');
    }
  })();
</script>
</head>
<body>
  <p>Redirecting to the article&hellip; if this doesn't work, <a href="/articles/">browse all articles</a>.</p>
</body>
</html>
`;
}

const STATIC_SITEMAP_URLS = [
  { loc: `${SITE_URL}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${SITE_URL}/market-pulse/`, changefreq: 'daily', priority: '0.9' },
  { loc: `${SITE_URL}/about.html`, changefreq: 'monthly', priority: '0.8' },
  { loc: `${SITE_URL}/faq.html`, changefreq: 'monthly', priority: '0.7' },
  { loc: `${SITE_URL}/partner.html`, changefreq: 'monthly', priority: '0.6' },
  { loc: `${SITE_URL}/fair-value-gap-explained.html`, changefreq: 'monthly', priority: '0.7' },
  { loc: `${SITE_URL}/london-killzone-explained.html`, changefreq: 'monthly', priority: '0.7' },
  { loc: `${SITE_URL}/articles/`, changefreq: 'weekly', priority: '0.8' },
  { loc: `${SITE_URL}/privacy.html`, changefreq: 'yearly', priority: '0.3' },
];

// Fixed lastmod values for the hand-maintained static pages above, so
// re-running this script doesn't bump their dates every time.
const STATIC_LASTMOD = {
  [`${SITE_URL}/`]: '2026-08-25',
  [`${SITE_URL}/market-pulse/`]: '2026-08-25',
  [`${SITE_URL}/about.html`]: '2026-08-08',
  [`${SITE_URL}/faq.html`]: '2026-08-08',
  [`${SITE_URL}/partner.html`]: new Date().toISOString().slice(0, 10),
  [`${SITE_URL}/fair-value-gap-explained.html`]: '2026-08-08',
  [`${SITE_URL}/london-killzone-explained.html`]: '2026-08-08',
  [`${SITE_URL}/articles/`]: new Date().toISOString().slice(0, 10),
  [`${SITE_URL}/privacy.html`]: '2026-08-08',
};

function sitemapXml(articles) {
  const staticEntries = STATIC_SITEMAP_URLS.map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${STATIC_LASTMOD[u.loc]}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  );

  const articleEntries = articles.map((a) => {
    const lastmod = a.published_at ? new Date(a.published_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    return `  <url>
    <loc>${SITE_URL}/articles/${encodeURIComponent(a.slug)}.html</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...articleEntries].join('\n')}
</urlset>
`;
}

async function main() {
  const articles = await fetchArticles();
  const valid = articles.filter((a) => a.slug && SAFE_SLUG.test(a.slug));
  const skipped = articles.length - valid.length;
  if (skipped > 0) {
    console.warn(`Skipping ${skipped} article(s) with missing/unsafe slugs.`);
  }

  await fs.mkdir(ARTICLES_DIR, { recursive: true });

  // Write per-article static pages.
  for (const article of valid) {
    const outPath = path.join(ARTICLES_DIR, `${article.slug}.html`);
    await fs.writeFile(outPath, articleHtml(article), 'utf8');
  }

  // Static listing page.
  await fs.writeFile(path.join(ARTICLES_DIR, 'index.html'), indexHtml(valid), 'utf8');

  // Redirect shim for legacy /articles/article.html?slug=... links.
  await fs.writeFile(path.join(ARTICLES_DIR, 'article.html'), articleRedirectHtml(), 'utf8');

  // Sitemap covering static pages + every published article.
  await fs.writeFile(path.join(ROOT, 'sitemap.xml'), sitemapXml(valid), 'utf8');

  console.log(`Generated ${valid.length} article page(s), the articles index, and sitemap.xml.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
