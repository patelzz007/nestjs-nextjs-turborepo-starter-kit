// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMPONENTS_NAV_STORAGE_KEY } from "@/components/component-gallery/gallery-nav-cookie";
import { GalleryShell } from "@/components/component-gallery/gallery-shell";

vi.mock("next/navigation", () => ({
	usePathname: (): string => "/components",
}));

const COOKIE = `${COMPONENTS_NAV_STORAGE_KEY}-open`;

afterEach(() => {
	cleanup();
	document.cookie = `${COOKIE}=; max-age=0; path=/`;
});

describe("GalleryShell", () => {
	it("shows the components list beside the page when the server rendered it open", () => {
		render(
			<GalleryShell initialNavOpen>
				<p>Page body</p>
			</GalleryShell>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("navigation", { name: "Components" })).toBeTruthy();
		expect(screen.getByText("Page body")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Hide the components list" }).getAttribute("aria-expanded")).toBe("true");
	});

	it("lets the list shrink to the capped sidebar height and scroll inside it", () => {
		render(
			<GalleryShell initialNavOpen>
				<p>Page body</p>
			</GalleryShell>,
			{ wrapper: UiKitTestProviders },
		);
		// jsdom has no layout, so the scroll contract is checked on its classes: a list that
		// cannot shrink (`shrink-0`) overflows the aside's `max-h` and is clipped instead of scrolling.
		const list = screen.getByRole("navigation", { name: "Components" }).parentElement;
		const classes = list?.className.split(" ") ?? [];
		expect(classes).toEqual(expect.arrayContaining(["min-h-0", "overflow-y-auto"]));
		expect(classes).not.toContain("shrink-0");
		expect(list?.parentElement?.className).toContain("lg:max-h-");
	});

	it("collapses to a rail and reopens, remembering each in its own cookie", () => {
		render(
			<GalleryShell initialNavOpen>
				<p>Page body</p>
			</GalleryShell>,
			{ wrapper: UiKitTestProviders },
		);
		fireEvent.click(screen.getByRole("button", { name: "Hide the components list" }));
		expect(screen.queryByRole("navigation", { name: "Components" })).toBeNull();
		expect(document.cookie).toContain(`${COOKIE}=false`);
		fireEvent.click(screen.getByRole("button", { name: "Show the components list" }));
		expect(screen.getByRole("navigation", { name: "Components" })).toBeTruthy();
		expect(document.cookie).toContain(`${COOKIE}=true`);
	});

	it("renders collapsed when the server rendered it closed", () => {
		render(
			<GalleryShell initialNavOpen={false}>
				<p>Page body</p>
			</GalleryShell>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.queryByRole("navigation", { name: "Components" })).toBeNull();
		expect(screen.getByRole("button", { name: "Show the components list" }).getAttribute("aria-expanded")).toBe("false");
	});

	it("keeps the collapsed list mounted but inert and hidden, so it can animate and keeps its state", () => {
		const { container } = render(
			<GalleryShell initialNavOpen={false}>
				<p>Page body</p>
			</GalleryShell>,
			{ wrapper: UiKitTestProviders },
		);
		const list = container.querySelector('nav[aria-label="Components"]')?.parentElement;
		expect(list?.hasAttribute("inert")).toBe(true);
		expect(list?.getAttribute("aria-hidden")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "Show the components list" }));
		expect(list?.hasAttribute("inert")).toBe(false);
		expect(list?.hasAttribute("aria-hidden")).toBe(false);
	});

	it("opens the list in a sheet on small screens, and closes it when a component is picked", async () => {
		render(
			<GalleryShell initialNavOpen={false}>
				<p>Page body</p>
			</GalleryShell>,
			{ wrapper: UiKitTestProviders },
		);
		fireEvent.click(screen.getByRole("button", { name: "Browse components" }));
		const sheet = await screen.findByRole("dialog", { name: "Components" });
		fireEvent.click(within(sheet).getByRole("link", { name: "Overview" }));
		await waitFor(() => {
			expect(screen.queryByRole("dialog", { name: "Components" })).toBeNull();
		});
	});
});
