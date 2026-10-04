// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchEntry } from "@/lib/search";

import { initSearch } from "./search";

const INDEX: readonly SearchEntry[] = [
	{ kind: "page", title: "Prisma", href: "/docs/technical/database", context: "Tooling", text: "Row level security <policies>" },
	{ kind: "heading", title: "Row-level security", href: "/docs/technical/database#rls", context: "Prisma", text: "" },
];

const MARKUP = `
	<button data-search-open>Search</button>
	<kbd data-search-shortcut>⌘K</kbd>
	<input id="outside" />
	<dialog data-search-dialog>
		<input data-search-input />
		<button data-search-close>Close</button>
		<ul data-search-results></ul>
		<p data-search-status>Type to search the guides.</p>
	</dialog>`;

const fetchIndex = vi.fn<() => Promise<Response>>();

function query<TElement extends Element>(selector: string, type: new () => TElement): TElement {
	const found = document.querySelector(selector);
	if (!(found instanceof type)) {
		throw new Error(`Missing ${selector}`);
	}
	return found;
}

function dialog(): HTMLDialogElement {
	return query("[data-search-dialog]", HTMLDialogElement);
}

function input(): HTMLInputElement {
	return query("[data-search-input]", HTMLInputElement);
}

function type(value: string): void {
	input().value = value;
	input().dispatchEvent(new Event("input"));
}

function titles(): readonly string[] {
	return [...document.querySelectorAll(".search-result__title")].map((title) => title.textContent);
}

function status(): HTMLElement {
	return query("[data-search-status]", HTMLElement);
}

describe("initSearch", () => {
	beforeAll(() => {
		// jsdom does not implement modal dialogs.
		Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
			configurable: true,
			value(this: HTMLDialogElement): void {
				this.open = true;
			},
		});
		Object.defineProperty(HTMLDialogElement.prototype, "close", {
			configurable: true,
			value(this: HTMLDialogElement): void {
				this.open = false;
			},
		});
		Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: (): void => undefined });
		vi.stubGlobal("fetch", fetchIndex);
	});

	beforeEach(() => {
		fetchIndex.mockReset();
		fetchIndex.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(INDEX))));
		document.body.innerHTML = MARKUP;
		initSearch();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("opens from the trigger, ⌘K, Ctrl K and /", () => {
		query("[data-search-open]", HTMLButtonElement).click();
		expect(dialog().open).toBe(true);
		dialog().close();
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
		expect(dialog().open).toBe(true);
		dialog().close();
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "K", ctrlKey: true }));
		expect(dialog().open).toBe(true);
		dialog().close();
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }));
		expect(dialog().open).toBe(true);
	});

	it("ignores / while typing in another field", () => {
		query("#outside", HTMLInputElement).dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
		expect(dialog().open).toBe(false);
	});

	it("shows ranked, highlighted results with safe HTML", async () => {
		type("security");
		await vi.waitFor(() => {
			expect(titles()).toEqual(["Row-level security", "Prisma"]);
		});
		expect(document.querySelector(".search-result__title mark")?.textContent).toBe("security");
		expect(document.querySelector(".search-result__excerpt")?.innerHTML).toContain("&lt;policies&gt;");
		expect(status().hidden).toBe(true);
	});

	it("reports empty results and resets on an empty query", async () => {
		type("nothing-matches");
		await vi.waitFor(() => {
			expect(status().textContent).toBe("No results for “nothing-matches”.");
		});
		type("  ");
		await vi.waitFor(() => {
			expect(status().textContent).toBe("Type to search the guides.");
		});
		expect(titles()).toEqual([]);
	});

	it("moves the selection with the arrow keys and opens it with Enter", async () => {
		const navigate = vi.fn<(href: string) => void>();
		document.body.innerHTML = MARKUP;
		initSearch(navigate);
		query("[data-search-open]", HTMLButtonElement).click();
		type("security");
		await vi.waitFor(() => {
			expect(titles()).toHaveLength(2);
		});
		input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
		expect(document.querySelector('[aria-selected="true"] .search-result__title')?.textContent).toBe("Prisma");
		input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
		expect(document.querySelector('[aria-selected="true"] .search-result__title')?.textContent).toBe("Row-level security");
		input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
		input().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		expect(navigate).toHaveBeenCalledWith("/docs/technical/database");
		expect(dialog().open).toBe(false);
	});

	it("closes from the close button and a backdrop click", () => {
		query("[data-search-open]", HTMLButtonElement).click();
		query("[data-search-close]", HTMLButtonElement).click();
		expect(dialog().open).toBe(false);
		query("[data-search-open]", HTMLButtonElement).click();
		dialog().dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(dialog().open).toBe(false);
	});

	it("shows the platform shortcut", () => {
		const expected = navigator.userAgent.includes("Mac") ? "⌘K" : "Ctrl K";
		expect(document.querySelector("[data-search-shortcut]")?.textContent).toBe(expected);
	});
});

describe("initSearch — unavailable index", () => {
	it("explains the failure and retries on the next query", async () => {
		vi.resetModules();
		const { initSearch: freshInit } = await import("./search");
		fetchIndex.mockReset();
		fetchIndex.mockImplementation(() => Promise.resolve(new Response("oops", { status: 500 })));
		document.body.innerHTML = MARKUP;
		freshInit();
		type("prisma");
		await vi.waitFor(() => {
			expect(status().textContent).toBe("Search is unavailable right now. Please try again.");
		});
		fetchIndex.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(INDEX))));
		type("prisma ");
		await vi.waitFor(() => {
			// The heading matches through its parent page ("Prisma"), ranked below the page itself.
			expect(titles()).toEqual(["Prisma", "Row-level security"]);
		});
		expect(fetchIndex.mock.calls.length).toBeGreaterThanOrEqual(2);
	});
});
