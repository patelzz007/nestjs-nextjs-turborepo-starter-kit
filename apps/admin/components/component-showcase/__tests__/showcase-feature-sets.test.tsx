// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SHOWCASE_FEATURE_INDEX } from "@/components/component-showcase/generated/feature-index";
import { SHOWCASE_FEATURE_SETS, type RenderFeatureSet } from "@/components/component-showcase/generated/feature-sets";
import { SHOWCASE_CATALOG_ORDER } from "@/components/component-showcase/showcase-catalog";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

/** A component page loads its features module, then one chunk per live example: allow for the largest. */
const LOAD_TIMEOUT_MS = 30_000;
/** Each feature's tabs: Preview and Code. */
const FEATURE_VIEWS = 2;

const SLUGS: readonly string[] = SHOWCASE_CATALOG_ORDER.map(({ entry }): string => entry.slug);

function featureSetOf(slug: string): RenderFeatureSet {
	const renderSet = SHOWCASE_FEATURE_SETS.get(slug);
	if (renderSet === undefined) {
		throw new Error(`No generated features module for "${slug}" — run \`pnpm showcase:generate\``);
	}
	return renderSet;
}

/**
 * The generated modules as a component page uses them: each one's dynamic
 * imports must resolve to the example its manifest names, and every feature
 * must mount its live preview, with its code a tab away (the shims report every section on
 * screen, so each one mounts).
 */
describe("every generated features module", () => {
	installJsdomUiShims();

	it.each(SLUGS)(
		"mounts every %s feature with its live example, its code a tab away",
		async (slug: string): Promise<void> => {
			const featureCount = (SHOWCASE_FEATURE_INDEX.get(slug) ?? []).length;
			const { container } = render(featureSetOf(slug)(), { wrapper: UiKitTestProviders });

			// A preview's loading state appears in the same commit as the preview itself,
			// so once every preview is mounted and none is loading, every example has loaded.
			await waitFor(
				(): void => {
					expect(container.querySelectorAll('[data-slot="feature-preview"]')).toHaveLength(featureCount);
					expect(container.querySelector('[data-slot="feature-loading"]')).toBeNull();
				},
				{ timeout: LOAD_TIMEOUT_MS },
			);
			expect(container.querySelectorAll("[data-showcase-feature]")).toHaveLength(featureCount);
			// Each feature offers its code behind a tab, mounted only once that tab is opened.
			expect(container.querySelectorAll('[data-feature-views] [role="tab"]')).toHaveLength(featureCount * FEATURE_VIEWS);
			expect(container.querySelector('[data-slot="feature-code-slot"]')).toBeNull();
			for (const preview of container.querySelectorAll('[data-slot="feature-preview"]')) {
				expect(preview.childElementCount, slug).toBeGreaterThan(0);
			}
		},
		LOAD_TIMEOUT_MS,
	);
});
