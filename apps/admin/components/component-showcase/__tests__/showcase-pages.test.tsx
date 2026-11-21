// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShowcaseComponentPageSkeleton, ShowcaseDocsPageSkeleton, ShowcasePageSkeleton } from "@/components/loading/showcase-skeleton";
import { SHOWCASE_FEATURE_INDEX, SHOWCASE_FEATURE_PARTS } from "@/components/component-showcase/generated/feature-index";
import { featuresOnPage, ShowcaseFeatureList } from "@/components/component-showcase/showcase-feature-list";
import type { ShowcaseFeature } from "@/components/component-showcase/showcase-feature";
import { SHOWCASE_CATALOG_ORDER, SHOWCASE_FAMILIES, showcaseItemBySlug, showcaseNeighbours } from "@/components/component-showcase/showcase-catalog";
import { resolveShowcasePart, ShowcaseComponentPage } from "@/components/component-showcase/showcase-component-page";
import type { ShowcaseOverview } from "@/components/component-showcase/showcase-content";
import { MissingShowcaseFeaturesError } from "@/components/component-showcase/showcase-errors";
import { ShowcaseFeatures } from "@/components/component-showcase/showcase-features";
import { featureCountLabel, ShowcasePage } from "@/components/component-showcase/showcase-page";
import { SHOWCASE_ROUTES } from "@/components/component-showcase/showcase-routes";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

/** A cold chunk is Vite transforming its module tree on demand, far slower than `waitFor`'s 1 s default. */
const CHUNK_LOAD_TIMEOUT_MS = 30_000;

interface CaughtErrorState {
	readonly error: Error | null;
}

/** Shows the message of whatever its children throw, so a test can assert on a render-time error. */
class CaughtError extends React.Component<{ readonly children: React.ReactNode }, CaughtErrorState> {
	public override state: CaughtErrorState = { error: null };

	public static getDerivedStateFromError(error: Error): CaughtErrorState {
		return { error };
	}

	public override render(): React.ReactNode {
		return this.state.error === null ? this.props.children : <p role="alert">{`${this.state.error.name}: ${this.state.error.message}`}</p>;
	}
}

describe("ShowcasePage (the index)", () => {
	it("lists every component as a card that opens its page, family by family", () => {
		const { container } = render(<ShowcasePage />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("heading", { level: 1, name: "Component showcase" })).toBeTruthy();
		const familyLinks = within(screen.getByRole("navigation", { name: "Component families" })).getAllByRole("link");
		expect(familyLinks.map((link) => link.getAttribute("href"))).toEqual(SHOWCASE_FAMILIES.map((family) => `#${family.id}`));
		expect(container.querySelectorAll("[data-showcase-card]")).toHaveLength(SHOWCASE_CATALOG_ORDER.length);
		const codeBlock = container.querySelector('[data-showcase-card="code-block"]');
		expect(codeBlock?.getAttribute("href")).toBe(SHOWCASE_ROUTES.component("code-block"));
		expect(codeBlock?.textContent).toContain(featureCountLabel(SHOWCASE_FEATURE_INDEX.get("code-block")?.length ?? 0));
		expect(container.querySelector("[data-showcase-feature]")).toBeNull();
	});

	it("counts features in words", () => {
		expect(featureCountLabel(1)).toBe("1 feature");
		expect(featureCountLabel(27)).toBe("27 features");
	});
});

/** A component's overview with one of everything the page renders from it. */
const OVERVIEW: ShowcaseOverview = {
	whenToUse: ["Showing a **keyboard** shortcut"],
	whenNotToUse: ["A button: use `Button`"],
	notes: ["Pair it with a tooltip"],
	body: "## Keyboard keys\n\nThe kit's key cap.",
	faq: [{ question: "Can it show a chord?", answer: "Yes, group several keys." }],
};

describe("ShowcaseComponentPage", () => {
	installJsdomUiShims();

	it("shows the guidance, the overview, the FAQ, the docs link and the closing call to action when the component has an overview", () => {
		const item = showcaseItemBySlug("kbd");
		if (item === undefined) {
			throw new Error("kbd is in the catalog");
		}
		render(<ShowcaseComponentPage item={item} overview={OVERVIEW} part={null} />, { wrapper: UiKitTestProviders });

		expect(within(screen.getByRole("region", { name: "When to use" })).getByText("keyboard")).toBeTruthy();
		expect(within(screen.getByRole("region", { name: "When not to use" })).getByText("Button")).toBeTruthy();
		expect(within(screen.getByRole("region", { name: "Notes" })).getByText("Pair it with a tooltip")).toBeTruthy();
		expect(screen.getByRole("heading", { level: 2, name: "Keyboard keys" })).toBeTruthy();
		expect(screen.getByRole("heading", { level: 2, name: "Frequently asked questions" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Can it show a chord?" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Docs & API" }).getAttribute("href")).toBe(SHOWCASE_ROUTES.docs("kbd"));
		expect(screen.getByRole("link", { name: /See ReUI pricing/u }).getAttribute("href")).toBe("https://reui.io/pricing");
	});

	it("leaves the overview sections out while the component has none", () => {
		const item = showcaseItemBySlug("kbd");
		if (item === undefined) {
			throw new Error("kbd is in the catalog");
		}
		render(<ShowcaseComponentPage item={item} overview={null} part={null} />, { wrapper: UiKitTestProviders });

		expect(screen.queryByRole("region", { name: "When to use" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Frequently asked questions" })).toBeNull();
		expect(screen.getByRole("heading", { level: 2, name: "Examples" })).toBeTruthy();
	});

	it("shows the component, jump links to every feature, each feature live with its code, and its neighbours", { timeout: CHUNK_LOAD_TIMEOUT_MS }, async (): Promise<void> => {
		const item = showcaseItemBySlug("kbd");
		expect(item).toBeDefined();
		if (item === undefined) {
			return;
		}
		const features = SHOWCASE_FEATURE_INDEX.get("kbd") ?? [];
		const { container } = render(<ShowcaseComponentPage item={item} overview={null} part={null} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("heading", { level: 1, name: "Kbd" })).toBeTruthy();
		expect(
			within(screen.getByRole("navigation", { name: "Kbd features" }))
				.getAllByRole("link")
				.map((link) => link.getAttribute("href")),
		).toEqual(features.map((feature) => `#${feature.anchor}`));
		await waitFor(
			(): void => {
				expect(container.querySelectorAll("[data-showcase-feature]")).toHaveLength(features.length);
				expect(container.querySelector('[data-slot="feature-loading"], [data-slot="feature-set-loading"]')).toBeNull();
				expect(container.querySelector(`#${features.at(0)?.anchor ?? ""} [data-slot="kbd"]`)).not.toBeNull();
			},
			{ timeout: CHUNK_LOAD_TIMEOUT_MS },
		);
		const first = features.at(0);
		expect(first).toBeDefined();
		if (first !== undefined) {
			const section = container.querySelector(`#${first.anchor}`);
			if (!(section instanceof HTMLElement)) {
				throw new Error("the first feature renders a section");
			}
			expect(section.querySelector('[data-slot="kbd"]')).not.toBeNull();
			expect(section.textContent).not.toContain("export function Kbd1Example(");
			fireEvent.click(within(section).getByRole("tab", { name: "Code" }));
			await waitFor((): void => {
				expect(section.textContent).toContain("export function Kbd1Example(");
			});
		}
		const more = within(screen.getByRole("navigation", { name: "More components" })).getAllByRole("link");
		const { previous, next } = showcaseNeighbours(item.key);
		expect(more.map((link) => link.getAttribute("href"))).toEqual(
			[previous, next].filter((neighbour) => neighbour !== undefined).map((neighbour) => SHOWCASE_ROUTES.component(neighbour.entry.slug)),
		);
	});

	it("fails loudly for a component without generated features", () => {
		render(
			<CaughtError>
				<ShowcaseFeatures slug="not-a-component" part={null} />
			</CaughtError>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("alert").textContent).toContain('MissingShowcaseFeaturesError: The showcase has no features for "not-a-component"');
		expect(new MissingShowcaseFeaturesError("x").slug).toBe("x");
	});
});

/** A feature whose example is a plain paragraph. */
function sampleFeature(anchor: string, part: string | null = null): ShowcaseFeature {
	return {
		id: `c-sample-${anchor}`,
		label: anchor,
		anchor,
		part,
		description: `The ${anchor} sample.`,
		file: `sample-${anchor}`,
		source: "x",
		render: (): React.JSX.Element => <p>{anchor}</p>,
	};
}

describe("ShowcaseFeatureList", () => {
	installJsdomUiShims();

	afterEach((): void => {
		window.history.replaceState(null, "", "/");
	});

	it("scrolls the feature a link points at into view once the list has rendered", () => {
		window.history.replaceState(null, "", "/showcase/sample#second");
		const scrolled: string[] = [];
		vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function recordScroll(this: Element): void {
			scrolled.push(this.id);
		});

		render(<ShowcaseFeatureList features={[sampleFeature("first"), sampleFeature("second")]} />, { wrapper: UiKitTestProviders });

		expect(scrolled).toEqual(["second"]);
	});

	it("leaves the scroll alone without a hash or for an unknown one", () => {
		const scrolled: string[] = [];
		vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function recordScroll(this: Element): void {
			scrolled.push(this.id);
		});
		render(<ShowcaseFeatureList features={[sampleFeature("first")]} />, { wrapper: UiKitTestProviders });
		window.history.replaceState(null, "", "/showcase/sample#nope");
		render(<ShowcaseFeatureList features={[sampleFeature("other")]} />, { wrapper: UiKitTestProviders });

		expect(scrolled).toEqual([]);
	});
});

describe("split component pages", () => {
	installJsdomUiShims();

	it("shows one part's features, and the Do / Don't pairs on the first part only", () => {
		const features = [sampleFeature("a", "basics"), sampleFeature("b", "recipes"), sampleFeature("c", "basics")];
		expect(featuresOnPage(features, null)).toEqual({ shown: features, showsGuidelines: true });
		expect(featuresOnPage(features, "basics").shown.map((feature) => feature.anchor)).toEqual(["a", "c"]);
		expect(featuresOnPage(features, "basics").showsGuidelines).toBe(true);
		expect(featuresOnPage(features, "recipes").shown.map((feature) => feature.anchor)).toEqual(["b"]);
		expect(featuresOnPage(features, "recipes").showsGuidelines).toBe(false);
	});

	it("finds a named part and knows an unknown one", () => {
		const parts = SHOWCASE_FEATURE_PARTS.get("data-table") ?? [];
		expect(parts.length).toBeGreaterThan(1);
		expect(resolveShowcasePart("data-table", parts.at(1)?.id ?? "")).toEqual(parts.at(1));
		expect(resolveShowcasePart("data-table", "no-such-part")).toBeUndefined();
		expect(resolveShowcasePart("kbd", "anything")).toBeUndefined();
	});

	it("shows every feature on the component's own page, with All examples marked current before the group tabs", () => {
		const item = showcaseItemBySlug("data-table");
		const parts = SHOWCASE_FEATURE_PARTS.get("data-table") ?? [];
		if (item === undefined) {
			throw new Error("data-table is in the catalog");
		}
		render(<ShowcaseComponentPage item={item} overview={null} part={null} />, { wrapper: UiKitTestProviders });
		const links = within(screen.getByRole("navigation", { name: "DataTable example groups" })).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			SHOWCASE_ROUTES.component("data-table"),
			...parts.map((part) => SHOWCASE_ROUTES.part("data-table", part.id)),
		]);
		expect(links.at(0)?.textContent).toBe("All examples");
		expect(links.at(0)?.getAttribute("aria-current")).toBe("page");
		expect(
			within(screen.getByRole("navigation", { name: "DataTable features" }))
				.getAllByRole("link")
				.map((link) => link.getAttribute("href")),
		).toEqual((SHOWCASE_FEATURE_INDEX.get("data-table") ?? []).map((feature) => `#${feature.anchor}`));
	});

	it("shows no group tabs on a component whose features are not grouped", () => {
		const item = showcaseItemBySlug("kbd");
		if (item === undefined) {
			throw new Error("kbd is in the catalog");
		}
		render(<ShowcaseComponentPage item={item} overview={null} part={null} />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("navigation", { name: "Kbd example groups" })).toBeNull();
	});

	it("links each part as its own route, marks the current one, and lists only that part's features", () => {
		const item = showcaseItemBySlug("data-table");
		const parts = SHOWCASE_FEATURE_PARTS.get("data-table") ?? [];
		const current = parts.at(1);
		if (item === undefined || current === undefined) {
			throw new Error("data-table is split into parts");
		}
		render(<ShowcaseComponentPage item={item} overview={null} part={current} />, { wrapper: UiKitTestProviders });
		const links = within(screen.getByRole("navigation", { name: "DataTable example groups" })).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			SHOWCASE_ROUTES.component("data-table"),
			...parts.map((part) => SHOWCASE_ROUTES.part("data-table", part.id)),
		]);
		expect(links.at(0)?.getAttribute("aria-current")).toBeNull();
		expect(links.at(2)?.getAttribute("aria-current")).toBe("page");
		const partFeatures = (SHOWCASE_FEATURE_INDEX.get("data-table") ?? []).filter((feature) => feature.part === current.id);
		expect(
			within(screen.getByRole("navigation", { name: "DataTable features" }))
				.getAllByRole("link")
				.map((link) => link.getAttribute("href")),
		).toEqual(partFeatures.map((feature) => `#${feature.anchor}`));
	});

	it("links a feature on a split page to its part's route", () => {
		expect(SHOWCASE_ROUTES.feature("data-table", "heatmap", "recipes-analytics")).toBe(`${SHOWCASE_ROUTES.part("data-table", "recipes-analytics")}#heatmap`);
		expect(SHOWCASE_ROUTES.feature("kbd", "basic", null)).toBe(`${SHOWCASE_ROUTES.component("kbd")}#basic`);
	});
});

describe("showcase loading states", () => {
	it("announces each page load once and mirrors each page's layout", () => {
		const index = render(<ShowcasePageSkeleton />, { wrapper: UiKitTestProviders });
		expect(within(index.container).getByRole("status")).toBeTruthy();
		expect(index.container.querySelectorAll('[data-skeleton="showcase-card"]').length).toBeGreaterThan(0);
		index.unmount();
		const page = render(<ShowcaseComponentPageSkeleton />, { wrapper: UiKitTestProviders });
		expect(within(page.container).getByRole("status")).toBeTruthy();
		expect(page.container.querySelectorAll('[data-skeleton="showcase-feature"]').length).toBeGreaterThan(0);
		page.unmount();
		const docs = render(<ShowcaseDocsPageSkeleton />, { wrapper: UiKitTestProviders });
		expect(within(docs.container).getByRole("status")).toBeTruthy();
		expect(docs.container.querySelectorAll('[data-skeleton="showcase-docs-section"]').length).toBeGreaterThan(0);
	});
});
