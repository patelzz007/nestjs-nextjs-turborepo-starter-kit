// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Settings } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BreadcrumbTrail } from "@workspace/ui/components/breadcrumb-trail";
import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/**
 * A minimal, framework-free link renderer for tests (the apps pass Next.js
 * `Link`). The trail clones the element and sets the crumb label as its
 * children, so the label given here is replaced, never duplicated.
 */
function renderLink(item: BreadcrumbItem): React.JSX.Element {
	return <a href={item.href}>{item.label}</a>;
}

function crumb(label: string, href?: string): BreadcrumbItem {
	return { label, href, icon: Settings };
}

describe("BreadcrumbTrail", () => {
	it("renders every crumb with an icon and the current page without a link", () => {
		const items: readonly BreadcrumbItem[] = [crumb("Settings", "/settings"), crumb("General")];

		render(<BreadcrumbTrail items={items} status="ready" renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Settings")).toBeTruthy();
		expect(screen.getByText("General")).toBeTruthy();
		// The current page renders inside the BreadcrumbPage span (aria-current).
		const currentPage = screen.getByText("General").closest("[data-slot=breadcrumb-page]");
		expect(currentPage?.getAttribute("aria-current")).toBe("page");
	});

	it("shows a skeleton while loading and nothing else", () => {
		const { container } = render(<BreadcrumbTrail items={[]} status="loading" renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		// Two shimmering pills are rendered.
		expect(container.querySelectorAll(".animate-pulse").length).toBe(2);
		expect(screen.queryByText("General")).toBeNull();
		expect(screen.getByLabelText(UI_KIT_LABELS_EN.breadcrumb.ariaLabel)).toBeTruthy();
	});

	it("shows the error message on error status", () => {
		render(<BreadcrumbTrail items={[]} status="error" errorMessage="Boom" renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Boom")).toBeTruthy();
	});

	it("renders nothing for an empty ready trail", () => {
		const { container } = render(<BreadcrumbTrail items={[]} status="ready" renderLink={renderLink} />, { wrapper: UiKitTestProviders });
		expect(container.innerHTML).toBe("");
	});

	it("collapses a long trail and renders the ellipsis trigger (hidden middle)", () => {
		const items: readonly BreadcrumbItem[] = [
			crumb("Overview", "/"),
			crumb("Analytics", "/analytics"),
			crumb("Reports", "/analytics/reports"),
			crumb("Marketing", "/analytics/reports/marketing"),
			crumb("Campaigns"),
		];

		render(<BreadcrumbTrail items={items} status="ready" maxItems={4} renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		// First + ellipsis + last 3 → hidden middle is only "Analytics".
		expect(screen.getByText("Overview")).toBeTruthy();
		expect(screen.getByText("Reports")).toBeTruthy();
		expect(screen.getByText("Marketing")).toBeTruthy();
		expect(screen.getByText("Campaigns")).toBeTruthy();
		expect(screen.queryByText("Analytics")).toBeNull();
		// The ellipsis trigger is a labelled button.
		expect(screen.getByLabelText(UI_KIT_LABELS_EN.breadcrumbTrail.moreBreadcrumbsAriaLabel)).toBeTruthy();
	});

	it("shows the hidden crumbs' labels inside the ellipsis popover (not just icons)", async () => {
		const items: readonly BreadcrumbItem[] = [
			crumb("Overview", "/"),
			crumb("Analytics", "/analytics"),
			crumb("Reports", "/analytics/reports"),
			crumb("Marketing", "/analytics/reports/marketing"),
			crumb("Campaigns"),
		];

		render(<BreadcrumbTrail items={items} status="ready" maxItems={4} renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		// Hidden crumb is not in the document until the popover opens.
		expect(screen.queryByText("Analytics")).toBeNull();

		fireEvent.click(screen.getByLabelText(UI_KIT_LABELS_EN.breadcrumbTrail.moreBreadcrumbsAriaLabel));

		// Regression: the popover renders the app-supplied BARE link element, so
		// the label must be injected — otherwise only the icon would show.
		await waitFor(() => {
			expect(screen.getByText("Analytics")).toBeTruthy();
		});
	});

	it("does not collapse a trail within maxItems", () => {
		const items: readonly BreadcrumbItem[] = [crumb("Settings", "/settings"), crumb("Security", "/settings/security"), crumb("Sessions")];

		render(<BreadcrumbTrail items={items} status="ready" maxItems={4} renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Settings")).toBeTruthy();
		expect(screen.getByText("Security")).toBeTruthy();
		expect(screen.getByText("Sessions")).toBeTruthy();
		expect(screen.queryByLabelText(UI_KIT_LABELS_EN.breadcrumbTrail.moreBreadcrumbsAriaLabel)).toBeNull();
	});

	it("renders the copy-link button", () => {
		render(<BreadcrumbTrail items={[crumb("Overview")]} status="ready" renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		expect(screen.getAllByLabelText(UI_KIT_LABELS_EN.breadcrumbTrail.copyLink).length).toBeGreaterThanOrEqual(1);
	});

	it("never makes the current page crumb focusable (improvement 15)", () => {
		render(<BreadcrumbTrail items={[crumb("Settings", "/settings"), crumb("General")]} status="ready" renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		const page = screen.getByText("General").closest("[data-slot=breadcrumb-page]");
		expect(page?.hasAttribute("tabindex")).toBe(false);
	});

	it("announces the error via role=status and fires onRetry (improvement 11)", () => {
		const onRetry = vi.fn();
		render(<BreadcrumbTrail items={[]} status="error" errorMessage="Boom" onRetry={onRetry} renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		const statusRegion = screen.getByRole("status");
		expect(statusRegion.textContent).toContain("Boom");
		fireEvent.click(screen.getByRole("button", { name: UI_KIT_LABELS_EN.breadcrumbTrail.retry }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("fires onCopy with the result and tints the button with the success token (improvement 8 + feature)", async () => {
		// Stub a working clipboard so the copy succeeds.
		// (Object.assign instead of spread — `navigator` is a class instance and spread would trip no-misused-spread.)
		vi.stubGlobal("navigator", Object.assign({}, navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } }));
		const onCopy = vi.fn();
		render(<BreadcrumbTrail items={[crumb("Overview")]} status="ready" onCopy={onCopy} renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		const copyButton = screen.getByLabelText(UI_KIT_LABELS_EN.breadcrumbTrail.copyLink);
		fireEvent.click(copyButton);

		await waitFor(() => {
			expect(onCopy).toHaveBeenCalledWith(true);
		});
		// Copied state routes through the `--success` token, not a raw emerald hex.
		expect(copyButton.className).toContain("text-success");
	});

	it("renders a custom separator shared by every crumb (feature)", () => {
		render(<BreadcrumbTrail items={[crumb("Settings", "/settings"), crumb("General")]} status="ready" separator={<span>›</span>} renderLink={renderLink} />, {
			wrapper: UiKitTestProviders,
		});

		expect(screen.getAllByText("›").length).toBeGreaterThanOrEqual(1);
	});

	it("passes the sm + scrollable variants down to the list (improvements 3/8)", () => {
		const { container } = render(<BreadcrumbTrail items={[crumb("Overview")]} status="ready" size="sm" scrollable renderLink={renderLink} />, { wrapper: UiKitTestProviders });

		const list = container.querySelector("[data-slot=breadcrumb-list]");
		expect(list?.className).toContain("overflow-x-auto");
		expect(list?.className).toContain("text-xs");
	});
});
