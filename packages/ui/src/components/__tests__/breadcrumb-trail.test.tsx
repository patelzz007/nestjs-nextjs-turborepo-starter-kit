// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FileText, Home } from "lucide-react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels, UiKitLabelsOverride } from "../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import type { BreadcrumbItem } from "./breadcrumb-context";
import { BreadcrumbTrail } from "./breadcrumb-trail";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";

afterEach((): void => {
	cleanup();
});

const ITEMS: readonly BreadcrumbItem[] = [
	{ label: "Home", href: "/", icon: Home },
	{ label: "Rewards", icon: FileText },
];

/** Three crumbs — collapsed behind the "more" popover when `maxItems` is 2. */
const COLLAPSIBLE_ITEMS: readonly BreadcrumbItem[] = [
	{ label: "Home", href: "/", icon: Home },
	{ label: "Catalog", href: "/catalog", icon: FileText },
	{ label: "Rewards", icon: FileText },
];

/** Stands in for the app's router link — the trail injects the crumb as its children. */
function TrailLink({ children, ...props }: React.ComponentProps<"a">): React.JSX.Element {
	return <a {...props}>{children}</a>;
}

function renderLink(item: BreadcrumbItem): React.ReactElement {
	return <TrailLink href={item.href} />;
}

/** A per-usage override of three strings — the rest must still come from the `breadcrumbTrail` family. */
const FRENCH_LABELS: UiKitLabelsOverride<"breadcrumbTrail"> = {
	errorMessage: "Fil d'Ariane indisponible",
	retry: "Réessayer",
	copyLink: "Copier le lien",
};

/** A label set whose breadcrumb families differ from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = {
	...UI_KIT_LABELS_EN,
	breadcrumb: { ariaLabel: "Brotkrumen", ellipsis: "Mehr" },
	breadcrumbTrail: { ...UI_KIT_LABELS_EN.breadcrumbTrail, copyLink: "Link kopieren", retry: "Erneut versuchen" },
};

describe("BreadcrumbTrail", () => {
	it("names the landmark and the copy action from the breadcrumb label families", (): void => {
		render(<BreadcrumbTrail items={ITEMS} status="ready" renderLink={renderLink} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("navigation", { name: UI_KIT_LABELS_EN.breadcrumb.ariaLabel })).toBeTruthy();
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.breadcrumbTrail.copyLink })).toBeTruthy();
	});

	it("renders translated copy for the error state and its retry action", (): void => {
		const onRetry = vi.fn();
		render(<BreadcrumbTrail items={ITEMS} status="error" renderLink={renderLink} labels={FRENCH_LABELS} onRetry={onRetry} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Fil d'Ariane indisponible")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("lets errorMessage override the labels' message", (): void => {
		render(<BreadcrumbTrail items={ITEMS} status="error" renderLink={renderLink} labels={FRENCH_LABELS} errorMessage="Custom" />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("Custom")).toBeTruthy();
	});

	it("accepts a landmark name and forwards its ref to the nav", (): void => {
		const ref = React.createRef<HTMLElement>();
		render(<BreadcrumbTrail ref={ref} ariaLabel="Fil d'Ariane" items={ITEMS} status="ready" renderLink={renderLink} labels={FRENCH_LABELS} />, {
			wrapper: UiKitTestProviders,
		});

		expect(ref.current?.tagName).toBe("NAV");
		expect(ref.current?.getAttribute("aria-label")).toBe("Fil d'Ariane");
		expect(screen.getByRole("button", { name: "Copier le lien" })).toBeTruthy();
	});

	it("keeps the family's strings that a partial labels prop leaves out", (): void => {
		render(<BreadcrumbTrail items={COLLAPSIBLE_ITEMS} status="ready" maxItems={2} renderLink={renderLink} labels={FRENCH_LABELS} />, {
			wrapper: UiKitTestProviders,
		});
		expect(screen.getByRole("button", { name: "Copier le lien" })).toBeTruthy();
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.breadcrumbTrail.moreBreadcrumbsAriaLabel }).getAttribute("title")).toBe(
			UI_KIT_LABELS_EN.breadcrumbTrail.showAllBreadcrumbsTitle,
		);
	});

	it("falls back to the family's error message when no errorMessage is passed", (): void => {
		render(<BreadcrumbTrail items={ITEMS} status="error" renderLink={renderLink} />, { wrapper: UiKitTestProviders });
		expect(screen.getByText(UI_KIT_LABELS_EN.breadcrumbTrail.errorMessage)).toBeTruthy();
	});

	it("reads the breadcrumb and breadcrumbTrail families from the nearest UiKitLabelsProvider", (): void => {
		const onRetry = vi.fn();
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<BreadcrumbTrail items={ITEMS} status="ready" renderLink={renderLink} />
				<BreadcrumbTrail items={ITEMS} status="error" renderLink={renderLink} onRetry={onRetry} />
			</UiKitLabelsProvider>,
		);
		expect(screen.getAllByRole("navigation", { name: GERMAN_LABELS.breadcrumb.ariaLabel })).toHaveLength(2);
		expect(screen.getByRole("button", { name: GERMAN_LABELS.breadcrumbTrail.copyLink })).toBeTruthy();
		expect(screen.getByRole("button", { name: GERMAN_LABELS.breadcrumbTrail.retry })).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", (): void => {
		expect(() => render(<BreadcrumbTrail items={ITEMS} status="ready" renderLink={renderLink} />)).toThrow('"breadcrumbTrail" labels');
	});
});
