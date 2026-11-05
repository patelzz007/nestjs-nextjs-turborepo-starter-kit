import { createIsomorphicFn } from "@tanstack/react-start";

/**
 * An article's rendered body travels once per page. Loader data is serialised into every pre-rendered page
 * for hydration (and written again as the page's static JSON for client navigation), so carrying the body
 * in it would ship the largest part of each page two or three times — the API reference pages, full of
 * highlighted code, tripled the build. Instead the body stays out of the page data:
 *
 * - **On the server** (SSR, pre-rendering) the server function remembers each body here as it renders it,
 *   and the page reads it back synchronously while rendering.
 * - **In the browser, on first load**, the body is already in the page: it is read from the element the
 *   server rendered, so hydration sees the same string.
 * - **On client navigation** the target page's own pre-rendered HTML is fetched and its body taken from it —
 *   no extra file, nothing stored twice.
 */

/** Marks the element that holds an article's body; its value is the article's source file. */
export const ARTICLE_BODY_ATTRIBUTE = "data-article-body";

const bodies = new Map<string, string>();

/** Server side: keeps a rendered body for the page being rendered (`sourcePath` is the article's file). */
export function rememberArticleBody(sourcePath: string, html: string): void {
	bodies.set(sourcePath, html);
}

/** The body the server rendered into `root` for `sourcePath`, or `null` when another article (or none) is there. */
export function bodyFromDocument(sourcePath: string, root: ParentNode = document): string | null {
	for (const element of root.querySelectorAll<HTMLElement>(`[${ARTICLE_BODY_ATTRIBUTE}]`)) {
		if (element.getAttribute(ARTICLE_BODY_ATTRIBUTE) === sourcePath) {
			return element.innerHTML;
		}
	}
	return null;
}

/** The body as the page shows it right now: remembered on the server, read from the document in the browser. */
export const readArticleBody = createIsomorphicFn()
	.server((sourcePath: string): string | null => bodies.get(sourcePath) ?? null)
	.client((sourcePath: string): string | null => bodyFromDocument(sourcePath));

/** A body that could not be loaded on client navigation (the page's HTML did not come back, or had no body). */
export class ArticleBodyUnavailableError extends Error {
	public constructor(
		public readonly pagePath: string,
		detail: string,
	) {
		super(`The text of ${pagePath} could not be loaded: ${detail}.`);
		this.name = "ArticleBodyUnavailableError";
	}
}

/** Client navigation: fetches the article's pre-rendered page and takes its body from it. */
export async function fetchArticleBody(pagePath: string, sourcePath: string, fetcher: typeof fetch = fetch): Promise<string> {
	const response = await fetcher(pagePath, { headers: { Accept: "text/html" } });
	if (!response.ok) {
		throw new ArticleBodyUnavailableError(pagePath, `HTTP ${String(response.status)}`);
	}
	const page = new DOMParser().parseFromString(await response.text(), "text/html");
	const body = bodyFromDocument(sourcePath, page);
	if (body === null) {
		throw new ArticleBodyUnavailableError(pagePath, "the page has no article body");
	}
	return body;
}
