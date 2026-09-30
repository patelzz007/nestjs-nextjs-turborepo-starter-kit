// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { initSidebar } from "./sidebar";

describe("initSidebar", () => {
	it("scrolls the active link towards the middle of the sidebar", () => {
		document.body.innerHTML = `<aside data-sidebar><a class="nav-node is-active" href="/docs/a">A</a></aside>`;
		const sidebar = document.querySelector<HTMLElement>("[data-sidebar]");
		const active = document.querySelector<HTMLElement>(".is-active");
		if (sidebar === null || active === null) {
			throw new Error("fixture missing");
		}
		Object.defineProperty(active, "offsetTop", { configurable: true, value: 900 });
		Object.defineProperty(sidebar, "clientHeight", { configurable: true, value: 400 });
		initSidebar();
		expect(sidebar.scrollTop).toBe(700);
	});

	it("does nothing without a sidebar or an active link", () => {
		document.body.innerHTML = `<aside data-sidebar></aside>`;
		expect(() => {
			initSidebar();
		}).not.toThrow();
		document.body.innerHTML = "";
		expect(() => {
			initSidebar();
		}).not.toThrow();
	});
});
