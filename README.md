# teredatrades-website

## Ideas / backlog

- **Multi-language site**: idea to eventually offer teredatrades.com in
  the same languages the Bejirond app is being built for — English,
  Amharic, Oromifa, French, Arabic, Swahili, Tigrinya. Not started —
  no i18n scaffolding, hreflang tags, or translated content exists yet
  (site is currently `lang="en"` only across every page).
  - **Structure decided (2026-09-09)**: subdirectories, not subdomains
    or ccTLDs — `/am/`, `/om/`, `/fr/`, `/ar/`, `/sw/`, `/ti/`, mirroring
    the existing page tree (index.html, about.html, faq.html,
    partner.html, articles/, market-pulse/, the two explainer pages).
    English stays at the root (no `/en/` prefix) to preserve existing
    indexing history/backlinks. Reasoning: subdirectories consolidate
    domain authority under one domain for both classic SEO and AI/AEO
    crawlers, rather than splitting trust across separate subdomains or
    domains that would each start from zero. (This resolves the open
    question noted below — logged as the decided approach.)
  - **hreflang**: every page needs `<link rel="alternate" hreflang="xx">`
    tags listing all language versions of itself + an `x-default`
    pointing to the English root. Since the site is static HTML with no
    templating layer, plan is to add these as hreflang annotations in
    `sitemap.xml` instead of hand-editing every page's `<head>` —
    `generate-articles.mjs` already writes `sitemap.xml` programmatically,
    so this is one script change rather than dozens of file edits. Each
    language page also needs a **self-referencing canonical** (not
    pointing back to English) since it's separate indexable content.
  - **The CMS (articles/) is the hard part.** Static marketing pages are
    just translated copies; the Supabase-backed blog needs either a
    `locale` column on the `articles` table (translated rows linked by a
    shared `translation_group_id`) or staying English-only for phase 1.
    Recommendation: phase 1 = static pages only, decide the Supabase
    schema change once translation workflow is proven out.
  - **Arabic needs RTL support** — `<html dir="rtl" lang="ar">` plus an
    RTL-aware pass on `styles.css` (currently LTR-only). Real layout
    work, not just translated strings.
  - **No forced language auto-redirect** based on browser locale — can
    block crawlers and annoys users; use a visible language switcher in
    the nav instead.
  - **Suggested phasing**: (1) static marketing pages in all 6 languages
    + hreflang via sitemap, (2) nav language switcher, (3) Arabic RTL
    support, (4) articles CMS localization (Supabase schema change),
    (5) Market Pulse localization (lowest priority — mostly
    numbers/tickers, least translation-dependent).
  - Not yet started — this is the agreed plan, no implementation work
    has begun.

## Open items (as of 2026-09-09)

- **Stale GitHub issues #3 and #4** ("generate-articles debug run") were
  auto-filed by the workflow before the Supabase-auth fix in `0a1a426`
  landed — both just capture the same 401 error, already resolved.
  Safe to close, not yet closed.
- **Cron schedule unconfirmed**: the `generate-articles.yml` workflow's
  `*/30 * * * *` schedule hadn't fired even once as of this check (all
  6 runs so far were push/workflow_dispatch triggered) — GitHub is
  sometimes slow to pick up a newly-created cron; worth confirming it's
  actually firing on its own next time this repo is checked.
- Fixed a wording inconsistency in `about.html` ("indexes" → "indices",
  matching every other page) — done, commit `ddf67c6`.
