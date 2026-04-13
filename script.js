const body = document.body;
const contentGrid = document.querySelector('.content-grid');
const sidebarToggle = document.getElementById('sidebarToggle');
// themeToggle, themeIcon, themeLabel live inside the header component
// and are looked up dynamically after the header embed loads.
// note: nav groups use class-based toggles (.moreToggle and .sub-nav)

const THEME_KEY = 'mara-theme';

// Determine the path prefix to the site root.
// Pages in sub-folders (e.g. pages/) include the script as "../script.js",
// so we detect depth by checking how the running <script> tag was referenced.
const _rootPath = (function () {
	const scripts = document.querySelectorAll('script[src$="script.js"]');
	for (const s of scripts) {
		const src = s.getAttribute('src') || '';
		if (src.startsWith('..')) return '../';
	}
	return '';
})();

function setTheme(theme) {
	document.documentElement.setAttribute('data-theme', theme);
	body.dataset.theme = theme;
	// switch highlight.js stylesheet to match site theme (dark -> csharp-colors)
	const hljsThemeLink = document.getElementById('hljsTheme');
	if (hljsThemeLink) {
		hljsThemeLink.href = theme === 'dark'
			? _rootPath + 'vendor/highlightjs/atom-one-dark.min.css'
			: _rootPath + 'vendor/highlightjs/github.min.css';
	}

	// Look up dynamically — these live inside the header component
	const themeIcon = document.getElementById('themeIcon');
	const themeLabel = document.getElementById('themeLabel');
	if (themeIcon && themeLabel) {
		if (theme === 'dark') {
			themeIcon.innerHTML = '&#9728;';
			themeLabel.textContent = 'Light';
		} else {
			themeIcon.innerHTML = '&#9790;';
			themeLabel.textContent = 'Dark';
		}
	}

	// Re-apply highlighting (safe no-op if hljs isn't loaded yet)
	if (typeof hljs !== 'undefined' && hljs.highlightAll) {
		try { hljs.highlightAll(); } catch (e) { /* ignore */ }
	}
}

function initTheme() {
	const savedTheme = localStorage.getItem(THEME_KEY);
	const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	setTheme(savedTheme || preferredTheme);
}

function initActiveNav() {
	const currentPage = body.dataset.page;
	const navLinks = document.querySelectorAll('.nav-link[data-page]');

	navLinks.forEach((link) => {
		const matches = link.dataset.page === currentPage;
		link.classList.toggle('active', matches);
	});

	// Open any sub-nav that contains an active link
	document.querySelectorAll('.sub-nav').forEach((sn) => {
		if (sn.querySelector('.nav-link.active')) {
			sn.hidden = false;
			const parentBtn = sn.previousElementSibling;
			if (parentBtn && parentBtn.classList.contains('nav-parent')) {
				parentBtn.setAttribute('aria-expanded', 'true');
				const chevron = parentBtn.querySelector('.chevron');
				if (chevron) chevron.textContent = '-';
			}
		}
	});
}

if (sidebarToggle && contentGrid) {
	sidebarToggle.addEventListener('click', () => {
		const isCollapsed = contentGrid.classList.toggle('sidebar-collapsed');
		sidebarToggle.textContent = isCollapsed ? '>' : '<';
		sidebarToggle.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
	});
}

// Bind theme toggle — called after embeds load so the header component is in the DOM
function initThemeToggle() {
	const themeToggle = document.getElementById('themeToggle');
	if (themeToggle) {
		themeToggle.addEventListener('click', () => {
			const nextTheme = body.dataset.theme === 'dark' ? 'light' : 'dark';
			setTheme(nextTheme);
			localStorage.setItem(THEME_KEY, nextTheme);
		});
	}
}

// Attach handlers to all group toggles (class="moreToggle")
const SIDEBAR_KEY = 'mara-sidebar-expanded';

function saveExpandedGroups() {
	const indices = [];
	document.querySelectorAll('.moreToggle').forEach((btn, i) => {
		if (btn.getAttribute('aria-expanded') === 'true') indices.push(i);
	});
	localStorage.setItem(SIDEBAR_KEY, JSON.stringify(indices));
}

function expandGroup(btn) {
	btn.setAttribute('aria-expanded', 'true');
	const chevron = btn.querySelector('.chevron');
	if (chevron) chevron.textContent = '-';
	const sub = btn.nextElementSibling;
	if (sub) sub.hidden = false;
}

function collapseGroup(btn) {
	btn.setAttribute('aria-expanded', 'false');
	const chevron = btn.querySelector('.chevron');
	if (chevron) chevron.textContent = '+';
	const sub = btn.nextElementSibling;
	if (sub) sub.hidden = true;
}

function initNavToggles() {
	document.querySelectorAll('.moreToggle').forEach((btn) => {
		btn.addEventListener('click', () => {
			const isExpanded = btn.getAttribute('aria-expanded') === 'true';
			if (isExpanded) {
				collapseGroup(btn);
			} else {
				expandGroup(btn);
			}
			saveExpandedGroups();
		});
	});
}

function restoreExpandedGroups() {
	try {
		const saved = JSON.parse(localStorage.getItem(SIDEBAR_KEY));
		if (!Array.isArray(saved)) return;
		const buttons = document.querySelectorAll('.moreToggle');
		saved.forEach((i) => {
			if (buttons[i]) expandGroup(buttons[i]);
		});
	} catch (e) { /* ignore bad data */ }
}

// Load the shared sidebar navigation from components/sidebar.html
async function loadSidebar() {
	const sidebar = document.getElementById('sidebar');
	if (!sidebar) return;

	const src = _rootPath + 'components/sidebar.html';
	try {
		const res = await fetch(src);
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		let html = await res.text();

		sidebar.innerHTML = html;

		// Rewrite root-relative hrefs when the page lives in a sub-folder.
		// The fragment uses root-relative paths like "pages/page1.html" and "index.html".
		// For a page inside pages/, we need "page1.html" and "../index.html".
		if (_rootPath === '../') {
			sidebar.querySelectorAll('a[href]').forEach((a) => {
				const href = a.getAttribute('href');
				if (href.startsWith('pages/')) {
					a.setAttribute('href', href.replace('pages/', ''));
				} else if (!href.startsWith('#') && !href.startsWith('http') && !href.startsWith('../')) {
					a.setAttribute('href', '../' + href);
				}
			});
		}

		initNavToggles();
		restoreExpandedGroups();
		initActiveNav();
	} catch (err) {
		sidebar.innerHTML = '<p class="embed-error">Failed to load navigation.</p>';
	}
}

initTheme();
loadSidebar();

// Fetch and insert any embeddable fragments (elements with data-src)
async function loadEmbed(el) {
	const src = el.getAttribute('data-src');
	if (!src) return;

	// Show a loading UI (accessible)
	el.innerHTML = `
		<div class="embed-loading" role="status" aria-live="polite">
			<span class="spinner" aria-hidden="true"></span>
			<span class="loading-text">Loading code…</span>
		</div>`;

	try {
		const res = await fetch(src);
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		const text = await res.text();
		el.innerHTML = text;

		// Rewrite root-relative links inside injected fragments when on a sub-page.
		// Components use root-absolute paths (e.g. /index.html, /pages/oop.html).
		// Live Server serves from the workspace root so absolute paths just work.
		// No further rewriting needed for root-absolute (slash-prefixed) hrefs.

		// highlight any code blocks inserted
		el.querySelectorAll('pre code').forEach((block) => {
			try { hljs.highlightElement(block); } catch (e) { /* highlight.js may not be available */ }
		});
	} catch (err) {
		// Show an error UI with retry
		el.innerHTML = `
			<div class="embed-error" role="alert">
				<div class="embed-error-message">Failed to load <strong>${src}</strong>: ${err.message}</div>
				<div class="embed-error-actions">
					<button class="embed-retry" type="button">Retry</button>
				</div>
			</div>`;

		const btn = el.querySelector('.embed-retry');
		if (btn) btn.addEventListener('click', () => loadEmbed(el));
	}
}

async function loadEmbeds() {
	const embeds = Array.from(document.querySelectorAll('[data-src]'));
	// Start all loads in parallel and wait for them to finish so we can build the TOC afterwards
	const promises = embeds.map(el => loadEmbed(el));
	await Promise.all(promises);

	// Now that the header component is in the DOM, bind its controls
	initThemeToggle();
	// Re-apply the current theme so the toggle icon/label reflect the correct state
	setTheme(body.dataset.theme || localStorage.getItem(THEME_KEY) || 'light');

	// After embeds are loaded, build/rebuild the floating TOC
	try { buildFloatingToc(); } catch (e) { /* ignore if builder missing */ }
}

// Start loading embeds after DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', loadEmbeds);
} else {
	loadEmbeds();
}

/* Floating TOC builder and behavior */
function slugify(text) {
	return text.toString().toLowerCase()
		.trim()
		.replace(/[^ -]+/g, '')
		.replace(/[^ -9a-z\- ]/g, '')
		.replace(/\s+/g, '-');
}

function buildFloatingToc() {
	const toc = document.getElementById('floatingToc');
	const tocList = document.getElementById('tocList');
	if (!toc || !tocList) return;

	// Find headings within the main panel / content card
	const headings = document.querySelectorAll('.main-panel .content-card h2, .main-panel .content-card h3');
	if (!headings.length) {
		toc.hidden = true;
		return;
	}
	toc.hidden = false;
	tocList.innerHTML = '';

	const ul = document.createElement('ul');
	tocList.appendChild(ul);
	let lastLiForH2 = null;

	headings.forEach((h) => {
		if (!h.id) h.id = slugify(h.textContent || h.innerText || 'heading');

		const li = document.createElement('li');
		const a = document.createElement('a');
		a.href = `#${h.id}`;
		a.textContent = h.textContent.trim();
		a.className = h.tagName.toLowerCase() === 'h2' ? 'toc-h2' : 'toc-h3';

		a.addEventListener('click', (ev) => {
			ev.preventDefault();
			document.getElementById(h.id).scrollIntoView({ behavior: 'smooth', block: 'start' });
			a.focus({ preventScroll: true });
		});

		if (h.tagName.toLowerCase() === 'h2') {
			lastLiForH2 = document.createElement('li');
			lastLiForH2.appendChild(a);
			const nestedUl = document.createElement('ul');
			lastLiForH2.appendChild(nestedUl);
			ul.appendChild(lastLiForH2);
		} else {
			if (lastLiForH2) {
				const nestedUl = lastLiForH2.querySelector('ul');
				const subLi = document.createElement('li');
				subLi.appendChild(a);
				nestedUl.appendChild(subLi);
			} else {
				const topLi = document.createElement('li');
				topLi.appendChild(a);
				ul.appendChild(topLi);
			}
		}
	});

	// IntersectionObserver to highlight active section
	const observerOptions = {
		root: null,
		rootMargin: '0px 0px -60% 0px',
		threshold: 0
	};

	if (window.__maraTocObserver) window.__maraTocObserver.disconnect();

	const linkMap = {};
	tocList.querySelectorAll('a[href^="#"]').forEach(a => {
		linkMap[a.getAttribute('href').slice(1)] = a;
	});

	window.__maraTocObserver = new IntersectionObserver((entries) => {
		entries.forEach(ent => {
			const id = ent.target.id;
			const link = linkMap[id];
			if (!link) return;
			if (ent.isIntersecting) {
				tocList.querySelectorAll('a.active').forEach(x => x.classList.remove('active'));
				link.classList.add('active');
			}
		});
	}, observerOptions);

	headings.forEach(h => window.__maraTocObserver.observe(h));
}

// TOC toggle + persistence
(function initTocToggle() {
	const toc = document.getElementById('floatingToc');
	const toggle = document.getElementById('tocToggle');
	if (!toc || !toggle) return;
	const KEY = 'mara-toc-collapsed';
	const collapsed = localStorage.getItem(KEY) === '1';
	if (collapsed) toc.classList.add('collapsed'), toggle.setAttribute('aria-expanded','false');

	toggle.addEventListener('click', () => {
		const isCollapsed = toc.classList.toggle('collapsed');
		toggle.setAttribute('aria-expanded', String(!isCollapsed));
		localStorage.setItem(KEY, isCollapsed ? '1' : '0');
	});
})();

// If embeds aren't used, build the TOC on DOM ready
document.addEventListener('DOMContentLoaded', () => {
	// If loadEmbeds is scheduled, it will call buildFloatingToc after completion.
	// Otherwise build immediately.
	if (typeof loadEmbeds !== 'function') buildFloatingToc();
});
