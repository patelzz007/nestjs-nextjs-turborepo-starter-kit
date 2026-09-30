// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { initDrawer, SCROLL_LOCK_CLASS } from "./drawer";

/** jsdom has no matchMedia; an EventTarget stand-in lets tests cross the desktop breakpoint. */
function installMatchMedia(): EventTarget {
	const media = Object.assign(new EventTarget(), { matches: false, media: "(min-width: 1024px)" });
	Object.defineProperty(window, "matchMedia", { configurable: true, value: () => media });
	return media;
}

function get<TElement extends Element>(selector: string, type: new () => TElement): TElement {
	const found = document.querySelector(selector);
	if (!(found instanceof type)) {
		throw new Error(`Missing ${selector}`);
	}
	return found;
}

const MARKUP = `
	<button data-drawer-toggle aria-expanded="false">Menu</button>
	<div data-drawer tabindex="-1">
		<button data-drawer-close>Close</button>
		<a class="nav-node is-active" href="#guide">Guide</a>
	</div>
	<div data-drawer-backdrop hidden></div>`;

describe("initDrawer", () => {
	let media: EventTarget;

	beforeEach(() => {
		media = installMatchMedia();
		Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: (): void => undefined });
		document.documentElement.classList.remove(SCROLL_LOCK_CLASS);
		document.body.innerHTML = MARKUP;
		initDrawer();
	});

	function drawerOpen(): boolean {
		return get("[data-drawer]", HTMLElement).classList.contains("is-open");
	}

	function open(): HTMLButtonElement {
		const toggle = get("[data-drawer-toggle]", HTMLButtonElement);
		toggle.focus();
		toggle.click();
		return toggle;
	}

	it("opens with the backdrop, scroll lock and focus on the close button", () => {
		const toggle = open();
		expect(drawerOpen()).toBe(true);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(get("[data-drawer-backdrop]", HTMLElement).hidden).toBe(false);
		expect(document.documentElement.classList.contains(SCROLL_LOCK_CLASS)).toBe(true);
		expect(document.activeElement).toBe(get("[data-drawer-close]", HTMLButtonElement));
	});

	it("closes from the close button and returns focus to the toggle", () => {
		const toggle = open();
		get("[data-drawer-close]", HTMLButtonElement).click();
		expect(drawerOpen()).toBe(false);
		expect(document.documentElement.classList.contains(SCROLL_LOCK_CLASS)).toBe(false);
		expect(get("[data-drawer-backdrop]", HTMLElement).hidden).toBe(true);
		expect(document.activeElement).toBe(toggle);
	});

	it("closes on backdrop click, Escape and link navigation", () => {
		open();
		get("[data-drawer-backdrop]", HTMLElement).click();
		expect(drawerOpen()).toBe(false);
		open();
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(drawerOpen()).toBe(false);
		open();
		get(".nav-node", HTMLAnchorElement).click();
		expect(drawerOpen()).toBe(false);
	});

	it("closes when the window widens to the desktop layout", () => {
		open();
		media.dispatchEvent(Object.assign(new Event("change"), { matches: true }));
		expect(drawerOpen()).toBe(false);
	});

	it("toggles closed from the menu button too", () => {
		const toggle = open();
		toggle.click();
		expect(drawerOpen()).toBe(false);
	});

	it("does nothing on pages without a drawer", () => {
		document.body.innerHTML = "";
		expect(() => {
			initDrawer();
		}).not.toThrow();
	});
});
