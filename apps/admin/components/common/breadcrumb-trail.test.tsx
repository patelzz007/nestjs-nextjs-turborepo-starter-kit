// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { BreadcrumbTrail } from "@workspace/ui/components/breadcrumb-trail";
import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";

afterEach(() => {
	cleanup();
});

/**
 * A minimal, framework-free link renderer for tests (the apps pass Next.js
 * `Link`). The label is rendered by the trail itself, so this returns a bare
 * anchor — text here would duplicate the crumb label in the DOM.
 */
function renderLink(): React.JSX.Element {
	return <a href="#" />;
}

function crumb(label: string, href?: string): BreadcrumbItem {
	return { label, href, icon: Settings };
}

describe("BreadcrumbTrail", () => {
	it("renders every crumb with an icon and the current page without a link", () => {
		const items: readonly BreadcrumbItem[] = [crumb("Settings", "/settings"), crumb("General")];

		render(<BreadcrumbTrail items={items} status="ready" renderLink={renderLink} />);

		expect(screen.getByText("Settings")).toBeTruthy();
		expect(screen.getByText("General")).toBeTruthy();
		// The current page renders inside the BreadcrumbPage span (aria-current).
		const currentPage = screen.getByText("General").closest("[data-slot=breadcrumb-page]");
		expect(currentPage?.getAttribute("aria-current")).toBe("page");
	});

	it("shows a skeleton while loading and nothing else", () => {
		const { container } = render(<BreadcrumbTrail items={[]} status="loading" renderLink={renderLink} />);

		// Two shimmering pills are rendered.
		expect(container.querySelectorAll(".animate-pulse").length).toBe(2);
		expect(screen.queryByText("General")).toBeNull();
		expect(screen.getByLabelText("breadcrumb")).toBeTruthy();
	});

	it("shows the error message on error status", () => {
		render(<BreadcrumbTrail items={[]} status="error" errorMessage="Boom" renderLink={renderLink} />);

		expect(screen.getByText("Boom")).toBeTruthy();
	});

	it("renders nothing for an empty ready trail", () => {
		const { container } = render(<BreadcrumbTrail items={[]} status="ready" renderLink={renderLink} />);
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

		render(<BreadcrumbTrail items={items} status="ready" maxItems={4} renderLink={renderLink} />);

		// First + ellipsis + last 3 → hidden middle is only "Analytics".
		expect(screen.getByText("Overview")).toBeTruthy();
		expect(screen.getByText("Reports")).toBeTruthy();
		expect(screen.getByText("Marketing")).toBeTruthy();
		expect(screen.getByText("Campaigns")).toBeTruthy();
		expect(screen.queryByText("Analytics")).toBeNull();
		// The ellipsis trigger is a labelled button.
		expect(screen.getByLabelText("More breadcrumbs")).toBeTruthy();
	});

	it("does not collapse a trail within maxItems", () => {
		const items: readonly BreadcrumbItem[] = [crumb("Settings", "/settings"), crumb("Security", "/settings/security"), crumb("Sessions")];

		render(<BreadcrumbTrail items={items} status="ready" maxItems={4} renderLink={renderLink} />);

		expect(screen.getByText("Settings")).toBeTruthy();
		expect(screen.getByText("Security")).toBeTruthy();
		expect(screen.getByText("Sessions")).toBeTruthy();
		expect(screen.queryByLabelText("More breadcrumbs")).toBeNull();
	});

	it("renders the copy-link button", () => {
		render(<BreadcrumbTrail items={[crumb("Overview")]} status="ready" renderLink={renderLink} />);

		// The button has aria-label + title with the same text, so expect one match.
		expect(screen.getAllByLabelText("Copy link to this page").length).toBeGreaterThanOrEqual(1);
	});
});
