// Automated accessibility checks for the browser suites (enhancement 3.2): axe-core run in a real browser over
// the whole page, so colour contrast and landmarks are checked too (jsdom can't, see `./axe`).
//
// Fails on the issues axe rates serious or critical, like the component tests.

import AxeBuilder from "@axe-core/playwright";

import { seriousViolations, type AccessibilityViolation } from "./axe";

/** The Playwright page the check runs on (typed from the builder, so this module needs no Playwright import). */
export type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

/** The WCAG 2.2 A and AA rules (and best practices axe rates serious or critical). */
const WCAG_TAGS: readonly string[] = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** The serious and critical accessibility problems on `page` as it is now (an empty list means none). */
export async function pageAccessibilityViolations(page: AxePage): Promise<readonly AccessibilityViolation[]> {
	const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
	return seriousViolations(results.violations);
}
