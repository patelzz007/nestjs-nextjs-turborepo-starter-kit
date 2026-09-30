import type { APIRoute } from "astro";
import { render } from "astro:content";

import { postHref } from "@/lib/blog";
import { getGuides, getPosts, navSectionsFor } from "@/lib/content";
import { findSection } from "@/lib/navigation";
import { toPlainText, type SearchEntry } from "@/lib/search";
import { buildToc } from "@/lib/toc";

/** Builds the client-side search index (see `src/lib/search.ts`). */
export const GET: APIRoute = async () => {
	const guides = await getGuides();
	const sections = navSectionsFor(guides);
	const posts = await getPosts();

	const guideEntries = await Promise.all(
		guides.map(async (guide): Promise<readonly SearchEntry[]> => {
			const href = `/docs/${guide.id}`;
			const { headings } = await render(guide);
			const page: SearchEntry = {
				kind: "page",
				title: guide.data.title,
				href,
				context: findSection(sections, guide.id)?.title ?? "Guides",
				text: toPlainText(`${guide.data.description ?? ""}\n\n${guide.body ?? ""}`),
			};
			const sectionsOfPage = buildToc(headings).map((item): SearchEntry => ({
				kind: "heading",
				title: item.text,
				href: `${href}#${item.slug}`,
				context: guide.data.title,
				text: "",
			}));
			return [page, ...sectionsOfPage];
		}),
	);
	const postEntries = posts.map((post): SearchEntry => ({
		kind: "page",
		title: post.data.title,
		href: postHref(post.id),
		context: `Blog · ${post.data.category}`,
		text: toPlainText(`${post.data.description}\n\n${post.body ?? ""}`),
	}));

	return new Response(JSON.stringify([...guideEntries.flat(), ...postEntries]), { headers: { "Content-Type": "application/json" } });
};
