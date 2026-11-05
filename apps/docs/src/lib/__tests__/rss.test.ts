import { describe, expect, it } from "vitest";

import { buildRssFeed, escapeXml } from "../rss";

describe("buildRssFeed", () => {
	it("should build an RSS 2.0 channel with absolute, escaped item links", () => {
		const xml = buildRssFeed({
			title: "Monorepo Docs blog",
			description: "Notes & lessons",
			site: "https://docs.example.com",
			items: [
				{
					title: "Fastify <vs> Express",
					description: "Why we moved",
					link: "/blog/fastify",
					pubDate: new Date(Date.UTC(2026, 8, 14)),
					author: "Platform Team",
					categories: ["Architecture"],
				},
			],
		});
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Monorepo Docs blog</title>')).toBe(true);
		expect(xml).toContain("<description>Notes &amp; lessons</description>");
		expect(xml).toContain("<link>https://docs.example.com/</link>");
		expect(xml).toContain('<guid isPermaLink="true">https://docs.example.com/blog/fastify</guid>');
		expect(xml).toContain("<title>Fastify &lt;vs&gt; Express</title>");
		expect(xml).toContain("<pubDate>Mon, 14 Sep 2026 00:00:00 GMT</pubDate>");
		expect(xml).toContain("<category>Architecture</category>");
		expect(xml.endsWith("</item></channel></rss>")).toBe(true);
	});

	it("should escape every XML special character", () => {
		expect(escapeXml(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
	});
});
