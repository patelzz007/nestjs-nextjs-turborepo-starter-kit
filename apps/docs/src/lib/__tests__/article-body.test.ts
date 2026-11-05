// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { ArticleBodyUnavailableError, bodyFromDocument, fetchArticleBody, readArticleBody, rememberArticleBody } from "../article-body";

function page(html: string, status = 200): typeof fetch {
	return (): Promise<Response> => Promise.resolve(new Response(html, { status }));
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("article bodies", () => {
	it("should hand back the body the server rendered for a page", () => {
		rememberArticleBody("docs/a.md", "<p>A</p>");
		expect(readArticleBody("docs/a.md")).toBe("<p>A</p>");
		expect(readArticleBody("docs/never.md")).toBeNull();
	});

	it("should read the body of the article in the document, and only that article's", () => {
		document.body.innerHTML = '<div data-article-body="docs/a.md"><p>Here</p></div>';
		expect(bodyFromDocument("docs/a.md")).toBe("<p>Here</p>");
		expect(bodyFromDocument("docs/b.md")).toBeNull();
	});

	it("should take the body from the article's fetched page", async () => {
		await expect(fetchArticleBody("/docs/a", "docs/a.md", page('<main><div data-article-body="docs/a.md"><h2 id="x">X</h2></div></main>'))).resolves.toBe('<h2 id="x">X</h2>');
	});

	it("should fail clearly when the page does not come back or has no body", async () => {
		await expect(fetchArticleBody("/docs/a", "docs/a.md", page("", 404))).rejects.toThrow(new ArticleBodyUnavailableError("/docs/a", "HTTP 404"));
		await expect(fetchArticleBody("/docs/a", "docs/a.md", page("<p>no body</p>"))).rejects.toThrow(/has no article body/);
	});
});
