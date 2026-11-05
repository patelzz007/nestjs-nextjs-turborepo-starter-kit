import { absoluteUrl, SITE_NAME } from "./site";

/**
 * Every page's `<head>`: the title with the site name, description, canonical URL, Open Graph and Twitter
 * cards (with the page's cover as the sharing image), and the breadcrumb trail as structured data
 * (schema.org `BreadcrumbList`). Returned in the shape a TanStack Router `head()` returns.
 */
export interface PageSeo {
	readonly title: string;
	readonly description: string;
	/** The page's path (`/docs/README`); the canonical URL is it on the site's origin. */
	readonly path: string;
	readonly image?: string | null | undefined;
	readonly type?: "website" | "article" | undefined;
	/** The trail from the site root to this page, for search engines' breadcrumbs. */
	readonly breadcrumbs?: readonly { readonly name: string; readonly path: string }[] | undefined;
}

export interface HeadMeta {
	readonly title?: string;
	readonly name?: string;
	readonly property?: string;
	readonly content?: string;
}

export interface HeadLink {
	readonly rel: string;
	readonly href: string;
	readonly type?: string;
	readonly title?: string;
}

export interface HeadScript {
	readonly type: string;
	readonly children: string;
}

export interface PageHead {
	readonly meta: HeadMeta[];
	readonly links: HeadLink[];
	readonly scripts: HeadScript[];
}

/** "Title · Monorepo Docs", or the site name alone for the home page. */
export function pageTitle(title: string): string {
	return title === SITE_NAME ? title : `${title} · ${SITE_NAME}`;
}

/** `<script type="application/ld+json">` text; `<` is escaped so the JSON can never close the script. */
export function breadcrumbJsonLd(breadcrumbs: readonly { readonly name: string; readonly path: string }[], siteUrl?: string): string {
	return JSON.stringify({
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: breadcrumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: absoluteUrl(crumb.path, siteUrl) })),
	}).replace(/</g, "\\u003c");
}

export function pageHead(seo: PageSeo, siteUrl?: string): PageHead {
	const title = pageTitle(seo.title);
	const canonical = absoluteUrl(seo.path, siteUrl);
	const image = seo.image === undefined || seo.image === null ? null : absoluteUrl(seo.image, siteUrl);
	const meta: HeadMeta[] = [
		{ title },
		{ name: "description", content: seo.description },
		{ property: "og:site_name", content: SITE_NAME },
		{ property: "og:title", content: title },
		{ property: "og:description", content: seo.description },
		{ property: "og:type", content: seo.type ?? "website" },
		{ property: "og:url", content: canonical },
		{ name: "twitter:card", content: image === null ? "summary" : "summary_large_image" },
		...(image === null ? [] : [{ property: "og:image", content: image }]),
	];
	const scripts: HeadScript[] =
		seo.breadcrumbs === undefined || seo.breadcrumbs.length === 0 ? [] : [{ type: "application/ld+json", children: breadcrumbJsonLd(seo.breadcrumbs, siteUrl) }];
	return { meta, links: [{ rel: "canonical", href: canonical }], scripts };
}
