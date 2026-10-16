// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { breadcrumbPageLabel } from "@workspace/ui/components/breadcrumb-context";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminBreadcrumbProvider, useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";
import { ComponentPage } from "@/components/component-gallery/component-page";
import { type GalleryCatalogItem, galleryItemBySlug, galleryNeighbours } from "@/components/component-gallery/gallery-catalog";

beforeEach(() => {
	// Keep every demo and example off screen: these tests are about the page around them.
	vi.stubGlobal(
		"IntersectionObserver",
		vi.fn(function OffscreenObserver() {
			return { observe: vi.fn(), disconnect: vi.fn() };
		}),
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function itemFor(slug: string): GalleryCatalogItem {
	const item = galleryItemBySlug(slug);
	if (item === undefined) {
		throw new Error(`No gallery component ${slug}`);
	}
	return item;
}

function PageLabelProbe(): React.JSX.Element {
	const { status } = useAdminBreadcrumb();
	return <output aria-label="Page label">{breadcrumbPageLabel(status) ?? ""}</output>;
}

function renderPage(slug: string): ReturnType<typeof render> {
	return render(
		<AdminBreadcrumbProvider pathname={`/components/${slug}`}>
			<ComponentPage item={itemFor(slug)} />
			<PageLabelProbe />
		</AdminBreadcrumbProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

describe("ComponentPage", () => {
	it("heads the page with the component's name, family and description", () => {
		renderPage("kbd");
		const item = itemFor("kbd");
		expect(screen.getByRole("heading", { level: 1, name: item.entry.name })).toBeTruthy();
		expect(screen.getByText(item.entry.description)).toBeTruthy();
		expect(screen.getByRole("link", { name: item.family.title }).getAttribute("href")).toBe(`/components#${item.family.id}`);
		expect(screen.getByText("6 examples")).toBeTruthy();
	});

	it("renders only this component's section of its family", () => {
		const { container } = renderPage("kbd");
		const sections = [...container.querySelectorAll("[data-gallery-section]")].map((section) => section.id);
		expect(sections).toEqual(["component-kbd"]);
		expect(screen.getByRole("heading", { level: 2, name: "Live demo" })).toBeTruthy();
		expect(screen.getByRole("heading", { level: 2, name: "Examples" })).toBeTruthy();
	});

	it("shows an examples-only component without a live demo", () => {
		const { container } = renderPage("rating");
		expect([...container.querySelectorAll("[data-gallery-section]")].map((section) => section.id)).toEqual(["component-rating"]);
		expect(screen.queryByRole("heading", { name: "Live demo" })).toBeNull();
		expect(screen.queryByText("Live demo")).toBeNull();
	});

	it("links to the previous and next components in catalog order", () => {
		renderPage("kbd");
		const { previous, next } = galleryNeighbours("kbd");
		const more = screen.getByRole("navigation", { name: "More components" });
		const hrefs = within(more)
			.getAllByRole("link")
			.map((link) => link.getAttribute("href"));
		expect(hrefs).toEqual([`/components/${previous?.entry.slug ?? ""}`, `/components/${next?.entry.slug ?? ""}`]);
	});

	it("has no previous link on the first component", () => {
		renderPage("button");
		const more = screen.getByRole("navigation", { name: "More components" });
		expect(within(more).getAllByRole("link")).toHaveLength(1);
		expect(within(more).getByRole("link").getAttribute("rel")).toBe("next");
	});

	it("names the last breadcrumb after the component", () => {
		renderPage("button-group");
		expect(screen.getByRole("status", { name: "Page label" }).textContent).toBe("ButtonGroup");
	});
});
