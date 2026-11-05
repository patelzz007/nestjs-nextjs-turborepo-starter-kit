import { describe, expect, it } from "vitest";

import { breadcrumbJsonLd, pageHead, pageTitle } from "../seo";
import { SITE_NAME } from "../site";

const SITE = "https://docs.example.com";

describe("pageHead", () => {
	it("should give an article its title, canonical URL, sharing image and breadcrumbs", () => {
		const head = pageHead(
			{
				title: "Authorization: start here",
				description: "The whole access system as one story.",
				path: "/docs/technical/authorization/overview",
				image: "https://images.example/cover.jpg",
				type: "article",
				breadcrumbs: [
					{ name: "Guides", path: "/docs" },
					{ name: "Authorization: start here", path: "/docs/technical/authorization/overview" },
				],
			},
			SITE,
		);
		expect(head.meta).toContainEqual({ title: `Authorization: start here · ${SITE_NAME}` });
		expect(head.meta).toContainEqual({ property: "og:type", content: "article" });
		expect(head.meta).toContainEqual({ property: "og:image", content: "https://images.example/cover.jpg" });
		expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
		expect(head.links).toEqual([{ rel: "canonical", href: `${SITE}/docs/technical/authorization/overview` }]);
		expect(head.scripts).toHaveLength(1);
	});

	it("should fall back to a summary card and no breadcrumbs when the page has neither image nor trail", () => {
		const head = pageHead({ title: SITE_NAME, description: "Guides.", path: "/", image: null }, SITE);
		expect(head.meta).toContainEqual({ title: SITE_NAME });
		expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary" });
		expect(head.meta.some((item) => item.property === "og:image")).toBe(false);
		expect(head.scripts).toEqual([]);
	});

	it("should resolve a site-relative cover against the origin", () => {
		expect(pageHead({ title: "X", description: "Y", path: "/blog/x", image: "/images/x.png" }, SITE).meta).toContainEqual({
			property: "og:image",
			content: `${SITE}/images/x.png`,
		});
	});
});

describe("breadcrumbJsonLd", () => {
	it("should number the trail from 1 and escape < so the JSON cannot close its script", () => {
		const json = breadcrumbJsonLd([{ name: "</script><b>", path: "/docs" }], SITE);
		expect(json).not.toContain("<");
		expect(JSON.parse(json)).toEqual({
			"@context": "https://schema.org",
			"@type": "BreadcrumbList",
			itemListElement: [{ "@type": "ListItem", position: 1, name: "</script><b>", item: `${SITE}/docs` }],
		});
	});

	it("should keep the site name alone for the home page title", () => {
		expect(pageTitle("Blog")).toBe(`Blog · ${SITE_NAME}`);
	});
});
