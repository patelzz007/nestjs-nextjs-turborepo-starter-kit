// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardGallery from "../dashboard-gallery";

/** The overview's live data is the cards' own concern; here they only mark their place. */
vi.mock("@/components/dashboard/platform-sales-cards", () => ({
	PlatformSalesCards: (): React.JSX.Element => <section aria-label="Platform sales" />,
}));

beforeEach(() => {
	// The gallery's sections mount only when scrolled near; jsdom has no layout, so nothing intersects.
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

describe("the admin landing page", () => {
	it("shows the overview, then the component gallery's samples where the gallery is served", () => {
		render(<DashboardGallery showComponentGallery />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("region", { name: "Platform sales" })).toBeDefined();
		expect(screen.getByRole("navigation", { name: "Jump to component demos" })).toBeDefined();
		expect(screen.getByRole("heading", { name: "Component gallery" })).toBeDefined();
	});

	it("shows the overview alone in a deployment without the gallery", () => {
		render(<DashboardGallery showComponentGallery={false} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("region", { name: "Platform sales" })).toBeDefined();
		expect(screen.queryByRole("navigation", { name: "Jump to component demos" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Component gallery" })).toBeNull();
	});
});
