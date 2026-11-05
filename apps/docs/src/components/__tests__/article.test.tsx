// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rememberArticleBody } from "@/lib/article-body";

import { ArticlePage } from "../article-page";
import { timeLeftLabel } from "../on-this-page";
import { Prose } from "../prose";
import { guidePage, postPage, TIMELINE } from "./fixtures";
import { renderWithRouter } from "./render-with-router";

/** jsdom has no layout: each heading gets a document position, and the article a fixed extent. */
const HEADING_TOPS: Readonly<Record<string, number>> = { "the-one-picture": 400, "where-the-code-lives": 1400, backend: 1700, glossary: 2400 };
const ARTICLE = { top: 200, bottom: 3200 };

function stubLayout(): void {
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function rect(this: HTMLElement): DOMRect {
		const top = HEADING_TOPS[this.id] ?? (this.tagName === "ARTICLE" ? ARTICLE.top : 0);
		const height = this.tagName === "ARTICLE" ? ARTICLE.bottom - ARTICLE.top : 20;
		return new DOMRect(0, top - window.scrollY, 600, height);
	});
}

function headingsHtml(): string {
	return TIMELINE.map((item) => `<h${String(item.depth)} id="${item.slug}">${item.text}</h${String(item.depth)}>`).join("<p>Body.</p>");
}

async function scrollTo(y: number): Promise<void> {
	await act(async () => {
		Object.defineProperty(window, "scrollY", { configurable: true, value: y });
		window.dispatchEvent(new Event("scroll"));
		await new Promise((resolve) => setTimeout(resolve, 40));
	});
}

beforeEach(() => {
	Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
	Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => ({ matches: false, addEventListener: (): void => undefined, removeEventListener: (): void => undefined }),
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("ArticlePage", () => {
	it("should show a guide's cover, icon, source file, title, summary, facts, tags, body and next page", async () => {
		await renderWithRouter(<ArticlePage page={guidePage()} sidebar={<p>Guide tree</p>} />);
		expect(screen.getByRole("heading", { level: 1, name: "Authorization: start here" })).toBeTruthy();
		expect(screen.getByText("docs/technical/authorization/overview.md")).toBeTruthy();
		expect(screen.getByText(/Who you are, which merchant/)).toBeTruthy();
		expect(screen.getByText("Platform Team")).toBeTruthy();
		expect(screen.getByText("4 min read")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Edit on GitHub" }).getAttribute("href")).toBe(guidePage().editUrl);
		expect(within(screen.getByRole("list", { name: "Tags" })).getAllByRole("listitem")).toHaveLength(2);
		expect(screen.getByText("Every request walks one path.")).toBeTruthy();
		expect(screen.getByRole("link", { name: /Next\s*Backend/ })).toBeTruthy();
		expect(screen.getByText("Guide tree")).toBeTruthy();
		expect(document.querySelector("time")?.getAttribute("datetime")).toBe(new Date(1793145600000).toISOString());
	});

	it("should warn on a superseded guide", async () => {
		await renderWithRouter(<ArticlePage page={guidePage({ superseded: true, description: null })} />);
		expect(screen.getByRole("note")).toBeTruthy();
		expect(screen.getByText("Superseded")).toBeTruthy();
	});

	it("should show a post without a cover, with its category as the tag and its publish date", async () => {
		await renderWithRouter(<ArticlePage page={postPage()} />);
		expect(screen.getByText("Published")).toBeTruthy();
		expect(screen.getByText("Architecture")).toBeTruthy();
		expect(screen.getByRole("link", { name: /Previous\s*Changelog/ })).toBeTruthy();
		expect(screen.queryByRole("complementary", { name: "On this page" })).toBeNull();
	});
});

describe("On this page", () => {
	it("should follow the reader: the ring, the node states, the current section's time and the time left", async () => {
		stubLayout();
		await renderWithRouter(<ArticlePage page={guidePage({ html: headingsHtml() })} />);
		const rail = screen.getByRole("complementary", { name: "On this page" });
		expect(within(rail).getByText(/About 3 min left/)).toBeTruthy();
		await scrollTo(1500);
		const current = within(rail).getByRole("link", { name: "Where the code lives" });
		expect(current.getAttribute("aria-current")).toBe("location");
		expect(current.closest("li")?.getAttribute("data-state")).toBe("current");
		expect(within(rail).getByRole("link", { name: "The one picture" }).closest("li")?.getAttribute("data-state")).toBe("read");
		expect(within(rail).getByRole("link", { name: "Glossary" }).closest("li")?.getAttribute("data-state")).toBe("upcoming");
		expect(within(rail).getByText(/in this section/)).toBeTruthy();
		await scrollTo(1700);
		expect(within(rail).getByRole("link", { name: "Backend" }).getAttribute("aria-current")).toBe("location");
		expect(within(rail).getByText(/% read/).textContent).not.toBe("0% read");
	});

	it("should copy the current section's link", async () => {
		stubLayout();
		const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		await renderWithRouter(<ArticlePage page={guidePage({ html: headingsHtml() })} />);
		await scrollTo(1500);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
			await Promise.resolve();
		});
		expect(writeText).toHaveBeenCalledWith(expect.stringContaining("#where-the-code-lives"));
		expect(screen.getByRole("button", { name: "Link copied" })).toBeTruthy();
	});

	it("should open the timeline in a sheet from the phone bar, and close it when an entry is picked", async () => {
		stubLayout();
		await renderWithRouter(<ArticlePage page={guidePage({ html: headingsHtml() })} />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /On this page: Introduction/ }));
			await Promise.resolve();
		});
		const sheet = await screen.findByRole("dialog", { name: "On this page" });
		await act(async () => {
			fireEvent.click(within(sheet).getByRole("link", { name: "Glossary" }));
			await Promise.resolve();
		});
		await vi.waitFor(() => {
			expect(screen.queryByRole("dialog", { name: "On this page" })).toBeNull();
		});
	});

	it("should say how much is left, in whole minutes", () => {
		expect(timeLeftLabel(0)).toBe("Nearly done");
		expect(timeLeftLabel(880)).toBe("About 4 min left");
	});
});

describe("Prose", () => {
	it("should render the body the server rendered, and release its islands when the article changes", async () => {
		rememberArticleBody("docs/first.md", "<p>First body</p>");
		rememberArticleBody("docs/second.md", "<p>Second body</p>");
		const first = await renderWithRouter(<Prose sourcePath="docs/first.md" pagePath="/docs/first" />);
		expect(screen.getByText("First body").closest("[data-article-body]")?.getAttribute("data-article-body")).toBe("docs/first.md");
		first.unmount();
		await renderWithRouter(<Prose sourcePath="docs/second.md" pagePath="/docs/second" />);
		expect(screen.getByText("Second body")).toBeTruthy();
		expect(screen.queryByText("First body")).toBeNull();
	});

	it("should fetch the body from the article's own page on client navigation, showing a skeleton meanwhile", async () => {
		// The page answers only when the test says so, so the skeleton is on screen however fast the run is.
		let answer = (_response: Response): void => undefined;
		const page = new Promise<Response>((resolve) => {
			answer = resolve;
		});
		vi.stubGlobal("fetch", (): Promise<Response> => page);
		const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
		await renderWithRouter(<Prose sourcePath="docs/nav.md" pagePath="/docs/nav" />);
		expect(screen.getByRole("status", { name: "Loading the page" }).childElementCount).toBe(5);
		answer(new Response('<html><body><div data-article-body="docs/nav.md"><p>Fetched body</p></div></body></html>'));
		expect(await screen.findByText("Fetched body")).toBeTruthy();
		expect(screen.queryByRole("status", { name: "Loading the page" })).toBeNull();
		// The skeleton's lines repeat widths; each still has its own key (React reports duplicates as errors).
		expect(errors).not.toHaveBeenCalled();
		errors.mockRestore();
		vi.unstubAllGlobals();
	});

	it("should say the text did not load when the page cannot be fetched", async () => {
		vi.stubGlobal("fetch", (): Promise<Response> => Promise.resolve(new Response("", { status: 503 })));
		await renderWithRouter(<Prose sourcePath="docs/gone.md" pagePath="/docs/gone" />);
		expect(await screen.findByText("This page’s text did not load")).toBeTruthy();
		vi.unstubAllGlobals();
	});
});
