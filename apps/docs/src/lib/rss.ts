/**
 * The blog's RSS 2.0 feed (`/feed.xml`), built at pre-render time. Every value is XML-escaped; links are
 * absolute, resolved against the site's public origin.
 */
export interface RssItem {
	readonly title: string;
	readonly description: string;
	/** Site-relative or absolute link to the post. */
	readonly link: string;
	readonly pubDate: Date;
	readonly author: string;
	readonly categories: readonly string[];
}

export interface RssChannel {
	readonly title: string;
	readonly description: string;
	/** The site's public origin (`PUBLIC_SITE_URL`). */
	readonly site: string;
	readonly items: readonly RssItem[];
}

const XML_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

export function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character);
}

function element(name: string, value: string): string {
	return `<${name}>${escapeXml(value)}</${name}>`;
}

function itemXml(item: RssItem, site: string): string {
	const link = new URL(item.link, site).href;
	return [
		"<item>",
		element("title", item.title),
		element("link", link),
		`<guid isPermaLink="true">${escapeXml(link)}</guid>`,
		element("description", item.description),
		element("pubDate", item.pubDate.toUTCString()),
		element("author", item.author),
		...item.categories.map((category) => element("category", category)),
		"</item>",
	].join("");
}

export function buildRssFeed(channel: RssChannel): string {
	const site = new URL("/", channel.site).href;
	return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>${element("title", channel.title)}${element("description", channel.description)}${element("link", site)}${channel.items
		.map((item) => itemXml(item, site))
		.join("")}</channel></rss>`;
}
