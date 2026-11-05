import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";
import { z } from "zod";

import { rememberArticleBody } from "../lib/article-body";
import { splitBody, type GuideMeta, type LearningCenter, type PostMeta, type PostSummary } from "../lib/content";
import { sidebarSections, type SidebarSection } from "../lib/navigation";

/**
 * The pages' data, as server functions. `staticFunctionMiddleware` writes each call's result to a JSON
 * file while the site pre-renders, and the browser reads that file on client-side navigation, so a
 * pre-rendered page never needs a live server for its data. The content module is imported inside each
 * handler, which keeps the Markdown, the renderer and Shiki out of the browser bundle. An article's body
 * is not part of the returned data (src/lib/article-body.ts): it is remembered for the page being rendered.
 */

/** A content id: a path below `docs/` or `blog/` without `.md` (it keeps its case, `README`). */
const ContentIdSchema = z.object({ id: z.string().min(1).max(300) }).strict();

/**
 * Narrows to the page, or answers with the router's 404: `notFound({ throw: true })` throws TanStack's own
 * not-found signal, which the server function carries to the route, so an unknown path renders the 404 page
 * with a 404 status.
 */
export function assertFound<TPage>(page: TPage | null): asserts page is TPage {
	if (page === null) {
		notFound({ throw: true });
	}
}

export const fetchNav = createServerFn({ method: "GET" })
	.middleware([staticFunctionMiddleware])
	.handler(async (): Promise<readonly SidebarSection[]> => {
		const { contentStore } = await import("./content.server");
		return sidebarSections((await contentStore()).navSections());
	});

export const fetchLearningCenter = createServerFn({ method: "GET" })
	.middleware([staticFunctionMiddleware])
	.handler(async (): Promise<LearningCenter> => {
		const { contentStore } = await import("./content.server");
		return (await contentStore()).learningCenter();
	});

export const fetchGuide = createServerFn({ method: "GET" })
	.middleware([staticFunctionMiddleware])
	.validator(ContentIdSchema)
	.handler(async ({ data }): Promise<GuideMeta> => {
		const { contentStore } = await import("./content.server");
		const page = await (await contentStore()).guide(data.id);
		assertFound(page);
		const { html, meta } = splitBody(page);
		rememberArticleBody(meta.sourcePath, html);
		return meta;
	});

export const fetchPosts = createServerFn({ method: "GET" })
	.middleware([staticFunctionMiddleware])
	.handler(async (): Promise<readonly PostSummary[]> => {
		const { contentStore } = await import("./content.server");
		return (await contentStore()).posts();
	});

export const fetchPost = createServerFn({ method: "GET" })
	.middleware([staticFunctionMiddleware])
	.validator(ContentIdSchema)
	.handler(async ({ data }): Promise<PostMeta> => {
		const { contentStore } = await import("./content.server");
		const page = await (await contentStore()).post(data.id);
		assertFound(page);
		const { html, meta } = splitBody(page);
		rememberArticleBody(meta.sourcePath, html);
		return meta;
	});
