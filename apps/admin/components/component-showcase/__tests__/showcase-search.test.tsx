// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ShowcaseSearch, groupShowcaseResults } from "@/components/component-showcase/showcase-search";
import { buildShowcaseSearchEntries, searchShowcase } from "@/components/component-showcase/showcase-search-index";
import { SHOWCASE_ROUTES } from "@/components/component-showcase/showcase-routes";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const push = vi.fn<(href: string) => void>();

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: (href: string) => void } => ({ push }),
}));

function searchBox(): HTMLElement {
	return screen.getByRole("combobox", { name: "Search components and features" });
}

function typeQuery(query: string): void {
	act((): void => {
		fireEvent.change(searchBox(), { target: { value: query } });
	});
}

describe("ShowcaseSearch", () => {
	installJsdomUiShims();

	it("groups results into components and features, leaving empty groups out", () => {
		const entries = buildShowcaseSearchEntries(SHOWCASE_ROUTES);
		expect(groupShowcaseResults(searchShowcase(entries, "code block")).map((group) => group.group)).toEqual(["Components", "Features"]);
		expect(groupShowcaseResults(searchShowcase(entries, "soft wrap")).map((group) => group.group)).toEqual(["Features"]);
		expect(groupShowcaseResults([])).toEqual([]);
	});

	it("is pinned to the top of the page and focused by the S key (/ belongs to the sidebar search)", () => {
		const { container } = render(<ShowcaseSearch />, { wrapper: UiKitTestProviders });
		expect(container.querySelector('[data-slot="showcase-search"]')?.className).toContain("sticky");
		act((): void => {
			fireEvent.keyDown(window, { key: "s" });
		});
		expect(document.activeElement).toBe(searchBox());
	});

	it("suggests matching components and features, and opens the one picked", () => {
		render(<ShowcaseSearch />, { wrapper: UiKitTestProviders });
		typeQuery("soft wrap");

		const option = screen.getByRole("option", { name: /^Soft Wrap/u });
		expect(within(option).getByText("CodeBlock")).toBeTruthy();
		act((): void => {
			fireEvent.click(option);
		});

		expect(push).toHaveBeenCalledWith(SHOWCASE_ROUTES.feature("code-block", "soft-wrap"));
		expect(searchBox()).toHaveProperty("value", "");
	});

	it("says so when nothing matches", () => {
		render(<ShowcaseSearch />, { wrapper: UiKitTestProviders });
		typeQuery("zzzz-no-such-thing");
		// Base UI appends an invisible word joiner so a repeated message is announced again; match the words.
		expect(screen.getByText(/^No component or feature matches\./u)).toBeTruthy();
	});
});
