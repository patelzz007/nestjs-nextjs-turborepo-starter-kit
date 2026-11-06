/**
 * The regression check against the last Astro build (`regression-baseline/routes.json`, captured
 * 2026-11-04): every page it published must still exist, with the same title, heading, sharing image,
 * canonical path and — on guides and posts — every heading anchor it had, so no link anyone
 * saved breaks. `scripts/check-baseline.ts` runs it with Node's own TypeScript support after the build, so
 * it imports nothing but zod.
 */
import { z } from "zod";

export const PageSnapshotSchema = z
	.object({
		title: z.string(),
		h1: z.string(),
		headingIds: z.array(z.string()),
		canonical: z.string().nullable(),
		ogImage: z.string().nullable(),
	})
	.strict();
export type PageSnapshot = z.output<typeof PageSnapshotSchema>;

export const BaselineSchema = z.object({
	capturedFrom: z.string(),
	pages: z.record(z.string(), PageSnapshotSchema),
	files: z.array(z.string()),
});
export type Baseline = Pick<z.output<typeof BaselineSchema>, "pages" | "files">;

/** Pages the Start site deliberately serves differently, and why. */
export const EXPECTED_CHANGES: Readonly<Record<string, string>> = {
	"/404": "rendered on request by the Start server (it answers 404 for any unknown path) instead of as a static file",
	"/sitemap-index.xml": "the Start build writes one /sitemap.xml (robots.txt points at it)",
	"/sitemap-0.xml": "the Start build writes one /sitemap.xml (robots.txt points at it)",
	"/images/readme/merchant-roles.webp": "an old README screenshot, removed 2026-11-06: nothing shows or retakes it",
	"/images/readme/mobile-pdf-search.webp": "an old README screenshot, removed 2026-11-06: nothing shows or retakes it",
};

/**
 * Headings deliberately renamed since the baseline, by page: old anchor → new anchor. The old anchor counts
 * as kept only if its replacement is on the page. Nothing in the repository links to these old anchors.
 */
export const RENAMED_ANCHORS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	// 2026-11-05: apps/docs left TypeScript 6 with the TanStack Start rewrite, so one holdout remains, not two.
	"/docs/technical/tooling/typescript": { "typescript-7-and-the-two-places-typescript-6-remains": "typescript-7-and-the-one-place-typescript-6-remains" },
};

const ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&nbsp;": " " };

export function decodeEntities(text: string): string {
	return text.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);
}

function textOf(html: string): string {
	return decodeEntities(html.replace(/<[^>]*>/g, ""))
		.replace(/\s+/g, " ")
		.trim();
}

function attribute(tag: string, name: string): string | null {
	const match = new RegExp(`\\s${name}="(?<value>[^"]*)"`).exec(tag);
	return match?.groups?.value === undefined ? null : decodeEntities(match.groups.value);
}

/** The facts the baseline records, read from one rendered page. */
export function snapshotOf(html: string): PageSnapshot {
	const title = /<title>(?<text>[\s\S]*?)<\/title>/.exec(html)?.groups?.text ?? "";
	const h1 = /<h1\b[^>]*>(?<text>[\s\S]*?)<\/h1>/.exec(html)?.groups?.text ?? "";
	const headingIds = [...html.matchAll(/<h[234]\b[^>]*\sid="(?<id>[^"]*)"/g)].map((match) => decodeEntities(match.groups?.id ?? ""));
	const [canonicalTag = ""] = /<link\b[^>]*rel="canonical"[^>]*>/.exec(html) ?? [];
	const [ogImageTag = ""] = /<meta\b[^>]*property="og:image"[^>]*>/.exec(html) ?? [];
	return { title: textOf(title), h1: textOf(h1), headingIds, canonical: attribute(canonicalTag, "href"), ogImage: attribute(ogImageTag, "content") };
}

/** A canonical URL's path without the `.html` the Astro build appended (`/docs/x.html` → `/docs/x`). */
export function canonicalPath(url: string | null): string | null {
	return url === null ? null : new URL(url).pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
}

function isArticle(route: string): boolean {
	return route.startsWith("/docs/") || route.startsWith("/blog/");
}

/** Every difference between the baseline and the new build; empty when nothing regressed. */
export function compareWithBaseline(baseline: Baseline, pages: ReadonlyMap<string, PageSnapshot>, files: ReadonlySet<string>): readonly string[] {
	const problems: string[] = [];
	for (const [route, before] of Object.entries(baseline.pages)) {
		if (EXPECTED_CHANGES[route] !== undefined) {
			continue;
		}
		const after = pages.get(route);
		if (after === undefined) {
			problems.push(`${route}: page missing`);
			continue;
		}
		if (after.title !== before.title) problems.push(`${route}: title "${before.title}" → "${after.title}"`);
		if (after.h1 !== before.h1) problems.push(`${route}: h1 "${before.h1}" → "${after.h1}"`);
		if (after.ogImage !== before.ogImage) problems.push(`${route}: og:image ${String(before.ogImage)} → ${String(after.ogImage)}`);
		if (canonicalPath(after.canonical) !== canonicalPath(before.canonical)) problems.push(`${route}: canonical ${String(before.canonical)} → ${String(after.canonical)}`);
		if (isArticle(route)) {
			const renamed = RENAMED_ANCHORS[route] ?? {};
			const lost = before.headingIds.filter((id) => !after.headingIds.includes(id) && !after.headingIds.includes(renamed[id] ?? id));
			if (lost.length > 0) problems.push(`${route}: anchors lost: ${lost.join(", ")}`);
		}
	}
	for (const file of baseline.files) {
		if (EXPECTED_CHANGES[file] === undefined && !files.has(file)) {
			problems.push(`${file}: file missing`);
		}
	}
	return problems;
}
