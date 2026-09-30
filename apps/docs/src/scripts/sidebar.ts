/** Desktop guide sidebar: scrolls the current page's link into view on load. */
export function initSidebar(): void {
	const sidebar = document.querySelector<HTMLElement>("[data-sidebar]");
	if (sidebar === null) {
		return;
	}
	const active = sidebar.querySelector<HTMLElement>(".nav-node.is-active");
	if (active === null) {
		return;
	}
	sidebar.scrollTop = Math.max(0, active.offsetTop - sidebar.clientHeight / 2);
}
