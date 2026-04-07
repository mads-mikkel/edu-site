const body = document.body;
const contentGrid = document.querySelector('.content-grid');
const sidebarToggle = document.getElementById('sidebarToggle');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
const moreToggle = document.getElementById('moreToggle');
const subNav = document.getElementById('subNav');

const THEME_KEY = 'mara-theme';

function setTheme(theme) {
	body.dataset.theme = theme;

	if (themeIcon && themeLabel) {
		if (theme === 'dark') {
			themeIcon.innerHTML = '&#9728;';
			themeLabel.textContent = 'Light';
		} else {
			themeIcon.innerHTML = '&#9790;';
			themeLabel.textContent = 'Dark';
		}
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

	if (currentPage && ['page4', 'page5', 'page6'].includes(currentPage)) {
		subNav.hidden = false;
		moreToggle.setAttribute('aria-expanded', 'true');
		moreToggle.querySelector('.chevron').textContent = '-';
	}
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

if (moreToggle && subNav) {
	moreToggle.addEventListener('click', () => {
		const isExpanded = moreToggle.getAttribute('aria-expanded') === 'true';
		const nextExpanded = !isExpanded;
		moreToggle.setAttribute('aria-expanded', String(nextExpanded));
		moreToggle.querySelector('.chevron').textContent = nextExpanded ? '-' : '+';
		subNav.hidden = !nextExpanded;
	});
}

initTheme();
initActiveNav();
