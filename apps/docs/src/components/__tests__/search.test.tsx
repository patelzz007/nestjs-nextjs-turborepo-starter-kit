// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSearchIndex } from "@/hooks/use-search-index";

import { LearningCenterView } from "../learning-center";
import { isSearchShortcut, useOpenSearch } from "../search-provider";
import { SearchPage } from "../search-page";
import { SiteHeader } from "../site-header";
import { jsonFetch, SEARCH_ENTRIES, SECTIONS } from "./fixtures";
import { renderWithRouter } from "./render-with-router";

beforeEach(() => {
	vi.stubGlobal("fetch", jsonFetch(SEARCH_ENTRIES));
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function typeInto(input: HTMLElement, value: string): Promise<void> {
	await act(async () => {
		fireEvent.change(input, { target: { value } });
		await new Promise((resolve) => setTimeout(resolve, 200));
	});
}

describe("isSearchShortcut", () => {
	const field = document.createElement("input");
	const plain = document.createElement("div");

	it("should open on ⌘K or Ctrl K anywhere, and on / outside a text field", () => {
		expect(isSearchShortcut({ key: "k", metaKey: true, ctrlKey: false, target: field })).toBe(true);
		expect(isSearchShortcut({ key: "K", metaKey: false, ctrlKey: true, target: plain })).toBe(true);
		expect(isSearchShortcut({ key: "/", metaKey: false, ctrlKey: false, target: plain })).toBe(true);
		expect(isSearchShortcut({ key: "/", metaKey: false, ctrlKey: false, target: field })).toBe(false);
		expect(isSearchShortcut({ key: "k", metaKey: false, ctrlKey: false, target: plain })).toBe(false);
	});
});

describe("fetchSearchIndex", () => {
	it("should validate the index and fail on a bad response", async () => {
		await expect(fetchSearchIndex(jsonFetch(SEARCH_ENTRIES))).resolves.toEqual(SEARCH_ENTRIES);
		await expect(fetchSearchIndex(jsonFetch({}, 500))).rejects.toThrow("HTTP 500");
		await expect(fetchSearchIndex(jsonFetch([{ kind: "page" }]))).rejects.toThrow();
	});
});

describe("useOpenSearch", () => {
	it("should refuse to run outside the search provider", () => {
		function Orphan(): null {
			useOpenSearch();
			return null;
		}
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		expect(() => render(<Orphan />)).toThrow(/SearchProvider/);
	});
});

describe("search dialog", () => {
	it("should open from the keyboard, find matches, and go to the one picked", async () => {
		const { router } = await renderWithRouter(<p>Page</p>);
		await act(async () => {
			fireEvent.keyDown(document, { key: "k", metaKey: true });
			await Promise.resolve();
		});
		const input = await screen.findByRole("combobox", { name: "Search the docs" });
		await screen.findByText(/Type to search/);
		await typeInto(input, "tenant");
		const result = await screen.findByRole("option", { name: /Tenant boundary/ });
		await act(async () => {
			fireEvent.click(result);
			await router.load();
		});
		expect(router.state.location.pathname).toBe("/docs/adr/014");
		expect(router.state.location.hash).toBe("tenant-boundary");
	});

	it("should say when nothing matches, and link to every result", async () => {
		const { router } = await renderWithRouter(<p>Page</p>);
		await act(async () => {
			fireEvent.keyDown(document, { key: "/" });
			await Promise.resolve();
		});
		await typeInto(await screen.findByRole("combobox", { name: "Search the docs" }), "kafka");
		expect(await screen.findByText(/No guide, heading or post matches/)).toBeTruthy();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "See every result" }));
			await router.load();
		});
		expect(router.state.location.pathname).toBe("/search");
	});

	it("should say search is unavailable when the index does not load", async () => {
		vi.stubGlobal("fetch", jsonFetch({}, 503));
		await renderWithRouter(<p>Page</p>);
		await act(async () => {
			fireEvent.keyDown(document, { key: "k", ctrlKey: true });
			await Promise.resolve();
		});
		expect(await screen.findByText(/Search is unavailable/)).toBeTruthy();
	});
});

describe("SearchPage", () => {
	it("should list the matches for the query in the URL, highlighted, and write typing back after a pause", async () => {
		const onQueryChange = vi.fn();
		await renderWithRouter(<SearchPage query="rows" onQueryChange={onQueryChange} />);
		expect(await screen.findByText(/1 results for “rows”/)).toBeTruthy();
		expect(screen.getByRole("link", { name: /Row-level security/ }).getAttribute("href")).toBe("/docs/technical/database/rls");
		expect(document.querySelector("mark")?.textContent).toBe("rows");
		await typeInto(screen.getByRole("searchbox"), "tenant");
		await waitFor(() => {
			expect(onQueryChange).toHaveBeenCalledWith("tenant");
		});
	});

	it("should prompt before a search, explain an empty result and report a failed index", async () => {
		const { unmount } = await renderWithRouter(<SearchPage query="" onQueryChange={vi.fn()} />);
		expect(await screen.findByText(/Type to search/)).toBeTruthy();
		unmount();
		const second = await renderWithRouter(<SearchPage query="zzz" onQueryChange={vi.fn()} />);
		expect(await screen.findByText(/Nothing matches “zzz”/)).toBeTruthy();
		second.unmount();
		vi.stubGlobal("fetch", jsonFetch({}, 500));
		await renderWithRouter(<SearchPage query="x" onQueryChange={vi.fn()} />);
		expect(await screen.findByText(/Search is unavailable/)).toBeTruthy();
	});
});

describe("SiteHeader", () => {
	it("should show the site's tabs, mark the current one, and send outbound tabs to a new tab", async () => {
		await renderWithRouter(<SiteHeader sections={SECTIONS} activeGuideId={null} />, "/blog");
		expect(screen.getByRole("link", { name: "Blog" }).getAttribute("aria-current")).toBe("page");
		expect(screen.getByRole("link", { name: "Guides" }).getAttribute("aria-current")).toBeNull();
		expect(screen.getByRole("link", { name: /Swagger/ }).getAttribute("target")).toBe("_blank");
	});

	it("should open the guide drawer on phones and search from the header", async () => {
		await renderWithRouter(<SiteHeader sections={SECTIONS} activeGuideId="technical/authorization/overview" />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Open the guide menu" }));
			await Promise.resolve();
		});
		const drawer = await screen.findByRole("dialog", { name: "Guides" });
		expect(drawer.querySelector('[aria-current="page"]')?.textContent).toBe("Authorization: start here");
		await act(async () => {
			fireEvent.click(screen.getAllByRole("link", { name: "Backend" }).at(-1) ?? drawer);
			await Promise.resolve();
		});
		await waitFor(() => {
			expect(screen.queryByRole("dialog", { name: "Guides" })).toBeNull();
		});
	});

	it("should open search from the header's search button", async () => {
		await renderWithRouter(<SiteHeader sections={SECTIONS} activeGuideId={null} />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /Search guides and endpoints/ }));
			await Promise.resolve();
		});
		expect(await screen.findByRole("dialog", { name: "Search the docs" })).toBeTruthy();
	});
});

describe("LearningCenterView", () => {
	it("should list every section with its guides and their first sections, and open search", async () => {
		await renderWithRouter(
			<LearningCenterView
				center={{
					sections: SECTIONS,
					quickLinks: { "technical/authorization/overview": [{ slug: "the-one-picture", text: "The one picture", depth: 2 }] },
					covers: { "technical/authorization/overview": "https://images.unsplash.com/photo-1?w=1600" },
				}}
			/>,
		);
		expect(screen.getByRole("heading", { level: 1, name: "Monorepo Learning Center" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "The one picture" }).getAttribute("href")).toBe("/docs/technical/authorization/overview#the-one-picture");
		expect(screen.getByText("2 guides")).toBeTruthy();
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /Search every guide/ }));
			await Promise.resolve();
		});
		expect(await screen.findByRole("dialog", { name: "Search the docs" })).toBeTruthy();
	});
});
