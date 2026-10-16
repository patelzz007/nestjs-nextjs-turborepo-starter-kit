// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it } from "vitest";

import { GALLERY_EXAMPLE_COUNTS } from "@/components/component-gallery/examples/examples-manifest";
import { GALLERY_CATALOG_ORDER, GALLERY_ENTRIES, GALLERY_FAMILIES } from "@/components/component-gallery/gallery-catalog";
import { GalleryOverview } from "@/components/component-gallery/gallery-overview";
import { formatCount } from "@/lib/format/numbers";

afterEach(() => {
	cleanup();
});

describe("GalleryOverview", () => {
	it("leads with the page heading and the kit's totals", () => {
		const { container } = render(<GalleryOverview />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("heading", { level: 1, name: "Components" })).toBeTruthy();
		const total = [...GALLERY_EXAMPLE_COUNTS.values()].reduce((sum, count) => sum + count, 0);
		const values = [...container.querySelectorAll("dl dd")].map((value) => value.textContent);
		expect(values).toEqual([formatCount(GALLERY_CATALOG_ORDER.length), formatCount(total), formatCount(GALLERY_FAMILIES.length)]);
	});

	it("groups a card per component under its family heading, each linking to the component's page", () => {
		render(<GalleryOverview />, { wrapper: UiKitTestProviders });
		for (const family of GALLERY_FAMILIES) {
			const section = screen.getByRole("region", { name: family.title });
			const hrefs = within(section)
				.getAllByRole("link")
				.map((link) => link.getAttribute("href"));
			expect(hrefs).toEqual(family.keys.map((key) => `/components/${GALLERY_ENTRIES[key].slug}`));
		}
	});

	it("names each card after its component, with its description and example count", () => {
		render(<GalleryOverview />, { wrapper: UiKitTestProviders });
		const card = screen.getByRole("link", { name: /^Kbd/u });
		expect(card.textContent).toContain(GALLERY_ENTRIES.kbd.description);
		expect(card.textContent).toContain("6 examples");
		expect(card.textContent).toContain("Live demo");
		// An examples-only component carries no live-demo badge.
		expect(screen.getByRole("link", { name: /^Rating/u }).textContent).not.toContain("Live demo");
	});

	it("lists the kit components the gallery leaves out", () => {
		render(<GalleryOverview />, { wrapper: UiKitTestProviders });
		const note = screen.getByRole("region", { name: "Not shown here" });
		expect(within(note).getAllByRole("listitem").length).toBeGreaterThan(0);
		expect(note.textContent).toContain("theme-provider");
	});
});
