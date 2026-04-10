# Copilot Instructions

## Architecture

This is a **static HTML educational site** ("HÅNDBOGEN I SOFTWAREKONSTRUKTION") with no build step. All pages are plain HTML files served directly by nginx via Docker. There is no JavaScript framework, bundler, or package manager.

```
index.html            ← home page
pages/                ← content pages (databases.html, oop.html, wpf.html, …)
components/sidebar.html ← shared navigation, loaded at runtime via fetch()
script.js             ← all client-side logic (sidebar, theme, embeds, TOC)
styles.css            ← all styles (CSS custom properties for theming)
vendor/highlightjs/   ← vendored highlight.js + themes (local, no CDN)
dockerfile            ← nginx:latest, copies repo to /usr/share/nginx/html
docker-compose.yaml   ← runs on port 1104, pulls from local Gitea registry
.gitea/workflows/     ← CI: builds & pushes Docker image on push to main
```

## Running Locally

Open `index.html` directly in a browser, or serve with any static file server:

```bash
docker compose up -d          # production-like via nginx on port 1104
python -m http.server 8080    # quick local dev
```

There are no tests, linters, or build commands.

## Page Template Convention

Every page (including `index.html`) follows the same structure:

- `<body data-page="<slug>">` — the slug must match the `data-page` attribute on the corresponding `<a>` in `components/sidebar.html` for active-link highlighting to work.
- Pages in `pages/` reference assets with `../` prefix (`../styles.css`, `../script.js`, `../vendor/…`).
- The inline `<script>` in `<head>` applies the saved theme immediately to prevent flash-of-wrong-theme — it must appear before the hljs stylesheet link.
- The floating TOC (`#floatingToc`) and sidebar `<aside id="sidebar">` are always present as empty shells; `script.js` populates them at runtime.

## Sidebar Navigation

`components/sidebar.html` is a single shared `<nav>` fragment fetched by `loadSidebar()` in `script.js`.

- Nav groups use `<button class="moreToggle nav-parent">` + `<div class="sub-nav" hidden>` pairs. Expanded state is persisted in `localStorage` under key `mara-sidebar-expanded`.
- All hrefs inside the sidebar use **root-relative paths** (e.g. `pages/oop.html`, `index.html`). `script.js` rewrites them automatically for pages inside `pages/` — do not use `../` paths in `sidebar.html`.

## Content Embeds

Any element with a `data-src="path/to/fragment.html"` attribute is populated at runtime by `loadEmbed()`. The fragment is injected as raw HTML. Code blocks (`<pre><code>`) inside fragments are syntax-highlighted via `hljs.highlightElement()` after injection.

Use this pattern to share reusable code snippets across multiple pages.

## Theming

- CSS custom properties are defined in `:root` (light) and overridden in `body[data-theme='dark'], html[data-theme='dark']`.
- Theme is stored in `localStorage` under key `mara-theme`. Always set `data-theme` on **both** `html` and `body`.
- The highlight.js stylesheet is swapped at runtime: `github.min.css` for light, `atom-one-dark.min.css` for dark.
- All color references in CSS must use the CSS variables (`--bg`, `--surface`, `--surface-2`, `--text`, `--muted`, `--accent`, `--accent-2`, `--line`, `--shadow`) — never hardcoded colors.

## Deployment

Push to `main` → Gitea Actions builds a Docker image and pushes to the local registry (`3kant-server.cv.local:1103`), then runs `docker compose up -d` on the host. Credentials are stored as Gitea secrets `REGISTRY_USERNAME` / `REGISTRY_PASSWORD`.
