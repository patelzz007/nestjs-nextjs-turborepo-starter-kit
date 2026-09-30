/** Matches the CSS breakpoint where the desktop sidebar replaces the drawer. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
/** Class on <html> that locks page scrolling while the drawer is open. */
export const SCROLL_LOCK_CLASS = "drawer-open";

/**
 * Small-screen navigation drawer (`MobileDrawer.astro`): opened by any
 * `[data-drawer-toggle]`, closed by its close button, the backdrop, Escape, a
 * link click, or widening the window to the desktop layout. While open it
 * locks page scroll, moves focus inside, and returns focus to the toggle on
 * close.
 */
export function initDrawer(): void {
	const drawer = document.querySelector<HTMLElement>("[data-drawer]");
	if (drawer === null) {
		return;
	}
	const backdrop = document.querySelector<HTMLElement>("[data-drawer-backdrop]");
	const closeButton = drawer.querySelector<HTMLButtonElement>("[data-drawer-close]");
	const toggles = [...document.querySelectorAll<HTMLButtonElement>("[data-drawer-toggle]")];
	let returnFocus: HTMLElement | null = null;

	const isOpen = (): boolean => drawer.classList.contains("is-open");

	const setOpen = (open: boolean): void => {
		drawer.classList.toggle("is-open", open);
		document.documentElement.classList.toggle(SCROLL_LOCK_CLASS, open);
		if (backdrop !== null) {
			backdrop.hidden = !open;
		}
		for (const toggle of toggles) {
			toggle.setAttribute("aria-expanded", String(open));
		}
		if (open) {
			returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			(closeButton ?? drawer).focus();
			drawer.querySelector<HTMLElement>(".nav-node.is-active")?.scrollIntoView({ block: "center" });
		} else {
			returnFocus?.focus();
			returnFocus = null;
		}
	};

	for (const toggle of toggles) {
		toggle.addEventListener("click", () => {
			setOpen(!isOpen());
		});
	}
	closeButton?.addEventListener("click", () => {
		setOpen(false);
	});
	backdrop?.addEventListener("click", () => {
		setOpen(false);
	});
	drawer.addEventListener("click", (event) => {
		if (event.target instanceof Element && event.target.closest("a[href]") !== null && isOpen()) {
			setOpen(false);
		}
	});
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && isOpen()) {
			setOpen(false);
		}
	});
	window.matchMedia(DESKTOP_QUERY).addEventListener("change", (event) => {
		if (event.matches && isOpen()) {
			setOpen(false);
		}
	});
}
