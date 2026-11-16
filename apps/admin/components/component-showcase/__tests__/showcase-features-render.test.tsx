// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ALL_FEATURE_EXAMPLES, ALL_GUIDELINE_EXAMPLES } from "@/components/component-showcase/generated/examples";
import { SHOWCASE_FEATURE_INDEX } from "@/components/component-showcase/generated/feature-index";
import { SHOWCASE_CATALOG_ORDER } from "@/components/component-showcase/showcase-catalog";
import type { ShowcaseFeatureExample, ShowcaseGuidelineExample } from "@/components/component-showcase/showcase-feature";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

/** Two pairs, each with its two sides. */
const MIN_GUIDELINE_SIDES = 4;

/** Every component's examples, statically (`generated/examples`). */
const EXAMPLES_BY_SLUG: ReadonlyMap<string, readonly ShowcaseFeatureExample[]> = ALL_FEATURE_EXAMPLES;

const CASES: readonly [string, string, ShowcaseFeatureExample][] = SHOWCASE_CATALOG_ORDER.flatMap(({ entry }): [string, string, ShowcaseFeatureExample][] =>
	(EXAMPLES_BY_SLUG.get(entry.slug) ?? []).map((example: ShowcaseFeatureExample): [string, string, ShowcaseFeatureExample] => [entry.slug, example.label, example]),
);

const GUIDELINE_CASES: readonly [string, string, ShowcaseGuidelineExample][] = SHOWCASE_CATALOG_ORDER.flatMap(({ entry }): [string, string, ShowcaseGuidelineExample][] =>
	(ALL_GUIDELINE_EXAMPLES.get(entry.slug) ?? []).map((example: ShowcaseGuidelineExample): [string, string, ShowcaseGuidelineExample] => [entry.slug, example.file, example]),
);

describe("every showcase feature", () => {
	installJsdomUiShims();

	it("lists exactly the features the index lists, for every component", () => {
		for (const { entry } of SHOWCASE_CATALOG_ORDER) {
			expect(
				(EXAMPLES_BY_SLUG.get(entry.slug) ?? []).map((example) => example.id),
				entry.slug,
			).toEqual((SHOWCASE_FEATURE_INDEX.get(entry.slug) ?? []).map((feature) => feature.id));
		}
	});

	it.each(CASES)("renders %s — %s", (_slug: string, _label: string, { component: Example }: ShowcaseFeatureExample): void => {
		const { container } = render(<Example />, { wrapper: UiKitTestProviders });
		expect(container.childElementCount).toBeGreaterThan(0);
	});

	it("gives every component at least two Do / Don't pairs", () => {
		for (const { entry } of SHOWCASE_CATALOG_ORDER) {
			expect((ALL_GUIDELINE_EXAMPLES.get(entry.slug) ?? []).length, entry.slug).toBeGreaterThanOrEqual(MIN_GUIDELINE_SIDES);
		}
	});

	it.each(GUIDELINE_CASES)("renders %s's Do / Don't side %s", (_slug: string, _file: string, { component: Example }: ShowcaseGuidelineExample): void => {
		const { container } = render(<Example />, { wrapper: UiKitTestProviders });
		expect(container.childElementCount).toBeGreaterThan(0);
	});
});
