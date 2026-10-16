// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActiveGalleryComponentProvider } from "@/components/component-gallery/active-gallery-component";
import { GALLERY_ENTRIES, type GalleryEntry } from "@/components/component-gallery/gallery-catalog";
import { ComponentSection, DemoRow, DemoSurface, DemoValue } from "@/components/component-gallery/gallery-section";

const ENTRY: GalleryEntry = { slug: "sample", id: "component-sample", name: "Sample", description: "A sample component." };

/** Keeps every lazy block off screen, so only headings and placeholders render. */
function stubOffscreenObserver(): void {
	vi.stubGlobal(
		"IntersectionObserver",
		vi.fn(function OffscreenObserver() {
			return { observe: vi.fn(), disconnect: vi.fn() };
		}),
	);
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("ComponentSection", () => {
	it("renders the anchor, labelled by the exported name, with its live demo under an h2", () => {
		render(
			<ComponentSection entry={ENTRY} height="h-24">
				<p>Demo body</p>
			</ComponentSection>,
		);
		const section = screen.getByRole("region", { name: "Sample" });
		expect(section.id).toBe("component-sample");
		expect(within(section).getByRole("heading", { level: 2, name: "Live demo" })).toBeTruthy();
		// No examples folder for this entry: no examples block.
		expect(within(section).queryByRole("heading", { name: "Examples" })).toBeNull();
	});

	it("adds the worked examples, with their count, for a component that has them", () => {
		stubOffscreenObserver();
		render(<ComponentSection entry={GALLERY_ENTRIES.kbd} />);
		const examples = screen.getByRole("region", { name: "Examples" });
		expect(within(examples).getByText("6")).toBeTruthy();
		// The page holds no live demo for a section without children.
		expect(screen.queryByRole("heading", { name: "Live demo" })).toBeNull();
	});

	it("renders only the active component's section under an ActiveGalleryComponentProvider", () => {
		render(
			<ActiveGalleryComponentProvider sectionId="component-other">
				<ComponentSection entry={ENTRY} height="h-24">
					<p>Demo body</p>
				</ComponentSection>
				<ComponentSection entry={{ ...ENTRY, slug: "other", id: "component-other", name: "Other" }} height="h-24">
					<p>Other body</p>
				</ComponentSection>
			</ActiveGalleryComponentProvider>,
		);
		expect(screen.queryByRole("region", { name: "Sample" })).toBeNull();
		expect(screen.getByRole("region", { name: "Other" })).toBeTruthy();
	});

	it("reserves the demo height until the section nears the viewport", () => {
		stubOffscreenObserver();
		const { container } = render(
			<ComponentSection entry={ENTRY} height="h-40">
				<p>Demo body</p>
			</ComponentSection>,
		);
		expect(screen.queryByText("Demo body")).toBeNull();
		expect(container.querySelector('[data-skeleton="section"]')?.classList.contains("h-40")).toBe(true);
		// The block heading stays, so the section is never empty.
		expect(screen.getByRole("heading", { name: "Live demo" })).toBeTruthy();
	});

	it("mounts the demos at once where IntersectionObserver is unavailable", () => {
		vi.stubGlobal("IntersectionObserver", undefined);
		render(
			<ComponentSection entry={ENTRY} height="h-24">
				<p>Demo body</p>
			</ComponentSection>,
		);
		expect(screen.getByText("Demo body")).toBeTruthy();
	});
});

describe("demo layout parts", () => {
	it("DemoRow labels its examples", () => {
		render(
			<DemoSurface>
				<DemoRow label="Sizes">
					<button type="button">Small</button>
				</DemoRow>
			</DemoSurface>,
		);
		expect(screen.getByText("Sizes")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Small" })).toBeTruthy();
	});

	it("DemoValue echoes a value under its label", () => {
		render(<DemoValue label="Page">3 of 12</DemoValue>);
		expect(screen.getByText("Page:", { exact: false }).textContent).toBe("Page: 3 of 12");
	});
});
