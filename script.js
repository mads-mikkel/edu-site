const body = document.body;
const contentGrid = document.querySelector('.content-grid');
const sidebarToggle = document.getElementById('sidebarToggle');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
// note: nav groups use class-based toggles (.moreToggle and .sub-nav)

const THEME_KEY = 'mara-theme';

function setTheme(theme) {
	body.dataset.theme = theme;
	// switch highlight.js stylesheet to match site theme (dark -> csharp-colors)
	const hljsThemeLink = document.getElementById('hljsTheme');
	if (hljsThemeLink) {
		hljsThemeLink.href = theme === 'dark'
			? 'vendor/highlightjs/atom-one-dark.min.css'
			: 'vendor/highlightjs/github.min.css';
	}

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

if (themeToggle) {
	themeToggle.addEventListener('click', () => {
		const nextTheme = body.dataset.theme === 'dark' ? 'light' : 'dark';
		setTheme(nextTheme);
		localStorage.setItem(THEME_KEY, nextTheme);
	});
}

// Attach handlers to all group toggles (class="moreToggle")
document.querySelectorAll('.moreToggle').forEach((btn) => {
	const sub = btn.nextElementSibling; // the .sub-nav
	btn.addEventListener('click', () => {
		const isExpanded = btn.getAttribute('aria-expanded') === 'true';
		const nextExpanded = !isExpanded;
		btn.setAttribute('aria-expanded', String(nextExpanded));
		const chevron = btn.querySelector('.chevron');
		if (chevron) chevron.textContent = nextExpanded ? '-' : '+';
		if (sub) sub.hidden = !nextExpanded;
	});
});

initTheme();
initActiveNav();

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
	const embeds = document.querySelectorAll('[data-src]');
	for (const el of embeds) {
		// Kick off each load without awaiting the previous to improve perceived speed
		// but keep error/retry handling per element
		loadEmbed(el);
	}
}

// Start loading embeds after DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', loadEmbeds);
} else {
	loadEmbeds();
}
