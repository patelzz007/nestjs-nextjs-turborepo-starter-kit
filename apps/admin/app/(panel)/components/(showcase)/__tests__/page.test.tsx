// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it } from "vitest";

import { SHOWCASE_CATALOG_ORDER } from "@/components/component-showcase/showcase-catalog";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";

import ComponentsLoading from "../loading";
import ComponentsPage from "../page";

afterEach(() => {
	cleanup();
});

describe("/components", () => {
	installJsdomUiShims();

	it("renders the component showcase: a jump link per family and a card per component", () => {
		const { container } = render(<ComponentsPage />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("heading", { level: 1, name: "Component showcase" })).toBeTruthy();
		expect(
			within(screen.getByRole("navigation", { name: "Component families" }))
				.getByRole("link", { name: /^Actions/u })
				.getAttribute("href"),
		).toBe("#family-actions");
		expect(container.querySelectorAll("[data-showcase-card]")).toHaveLength(SHOWCASE_CATALOG_ORDER.length);
	});

	it("streams in behind a skeleton shaped like the page", () => {
		const { container } = render(<ComponentsLoading />, { wrapper: UiKitTestProviders });
		expect(container.querySelector('[data-skeleton="showcase-header"]')).not.toBeNull();
	});
});
