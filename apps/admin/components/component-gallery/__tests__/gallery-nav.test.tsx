// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GALLERY_FAMILIES } from "@/components/component-gallery/gallery-catalog";
import { filterGalleryFamilies, GalleryNav } from "@/components/component-gallery/gallery-nav";

const pathname = vi.hoisted(() => ({ current: "/components/button-group" }));

vi.mock("next/navigation", () => ({
	usePathname: (): string => pathname.current,
}));

afterEach(() => {
	cleanup();
	pathname.current = "/components/button-group";
});

function nav(): HTMLElement {
	return screen.getByRole("navigation", { name: "Components" });
}

function linkNames(): readonly (string | null)[] {
	return within(nav())
		.getAllByRole("link")
		.map((link) => link.textContent);
}

describe("filterGalleryFamilies", () => {
	it("keeps every family and component for a blank query", () => {
		expect(filterGalleryFamilies(GALLERY_FAMILIES, "  ").map(({ keys }) => keys)).toEqual(GALLERY_FAMILIES.map((family) => family.keys));
	});

	it("matches component names case-insensitively and drops families left empty", () => {
		const matches = filterGalleryFamilies(GALLERY_FAMILIES, "TOGGLE");
		expect(matches.map(({ family }) => family.id)).toEqual(["family-actions"]);
		expect(matches.flatMap(({ keys }) => keys)).toEqual(["toggle", "toggleGroup"]);
		expect(filterGalleryFamilies(GALLERY_FAMILIES, "no such component")).toEqual([]);
	});
});

describe("GalleryNav", () => {
	it("opens the current page's family, marks its link, and keeps the other families collapsed", () => {
		render(<GalleryNav />, { wrapper: UiKitTestProviders });
		const current = within(nav()).getByRole("link", { name: "ButtonGroup" });
		expect(current.getAttribute("href")).toBe("/components/button-group");
		expect(current.getAttribute("aria-current")).toBe("page");
		expect(
			within(nav())
				.getByRole("button", { name: /Actions/u })
				.getAttribute("aria-expanded"),
		).toBe("true");
		expect(
			within(nav())
				.getByRole("button", { name: /Overlays/u })
				.getAttribute("aria-expanded"),
		).toBe("false");
		expect(within(nav()).queryByRole("link", { name: "Dialog" })).toBeNull();
	});

	it("expands and collapses a family from its title row", () => {
		render(<GalleryNav />, { wrapper: UiKitTestProviders });
		const overlays = within(nav()).getByRole("button", { name: /Overlays/u });
		fireEvent.click(overlays);
		expect(overlays.getAttribute("aria-expanded")).toBe("true");
		expect(within(nav()).getByRole("link", { name: "Dialog" }).getAttribute("href")).toBe("/components/dialog");
		fireEvent.click(overlays);
		expect(overlays.getAttribute("aria-expanded")).toBe("false");
	});

	it("opens every family on the overview, and marks the overview link", () => {
		pathname.current = "/components";
		render(<GalleryNav />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
		const componentCount = GALLERY_FAMILIES.reduce((sum, family) => sum + family.keys.length, 0);
		expect(linkNames()).toHaveLength(componentCount + 1);
	});

	it("filters as the user types, expanding every match, then clears", () => {
		render(<GalleryNav />, { wrapper: UiKitTestProviders });
		const filter = screen.getByRole("textbox", { name: "Filter components" });
		fireEvent.change(filter, { target: { value: "dialog" } });
		// Overlays was collapsed; a filter shows its matches anyway.
		expect(linkNames()).toEqual(["Overview", "Dialog", "AlertDialog"]);
		fireEvent.change(filter, { target: { value: "zzz" } });
		expect(screen.getByText("No component matches.")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Clear the filter" }));
		expect(filter).toHaveProperty("value", "");
		expect(screen.queryByRole("button", { name: "Clear the filter" })).toBeNull();
	});
});
