// Automated accessibility checks for UI kit tests (enhancement 3.2), with axe-core run over the rendered DOM.
//
// Reports the issues axe rates **serious** or **critical**: the ones that block someone using a screen reader
// or a keyboard. Two rules are off here, each for a reason that holds in jsdom only:
// - `color-contrast`: jsdom has no layout or computed colours, so contrast can't be measured. The browser
//   suites (real rendering) are where contrast is checked.
// - `region`: "all content inside landmarks" is a page-level rule; a single component isn't a page.

import axe from "axe-core";

/** The impact levels that fail a test. */
const FAILING_IMPACTS: ReadonlySet<string> = new Set(["serious", "critical"]);

/** Rules that can't give a true answer in jsdom (see the file comment). */
const JSDOM_DISABLED_RULES: Readonly<Record<string, { readonly enabled: false }>> = {
	"color-contrast": { enabled: false },
	region: { enabled: false },
};

/** One problem axe found, small enough to read in a failing test's diff. */
export interface AccessibilityViolation {
	readonly rule: string;
	readonly impact: string;
	readonly help: string;
	/** CSS selectors of the elements at fault. */
	readonly targets: readonly string[];
	/** The elements at fault, as HTML (what to look for when a test fails). */
	readonly html: readonly string[];
}

/** The serious and critical ones of axe's violations, as {@link AccessibilityViolation}s (shared with the browser check). */
export function seriousViolations(violations: readonly axe.Result[]): readonly AccessibilityViolation[] {
	return violations
		.filter((violation) => violation.impact !== undefined && violation.impact !== null && FAILING_IMPACTS.has(violation.impact))
		.map((violation): AccessibilityViolation => ({
			rule: violation.id,
			impact: violation.impact ?? "",
			help: violation.help,
			targets: violation.nodes.flatMap((node) => node.target.map(String)),
			html: violation.nodes.map((node) => node.html),
		}));
}

/** The serious and critical accessibility problems in `container` (an empty list means none). */
export async function accessibilityViolations(container: Element): Promise<readonly AccessibilityViolation[]> {
	const results = await axe.run(container, { rules: JSDOM_DISABLED_RULES, resultTypes: ["violations"] });
	return seriousViolations(results.violations);
}
