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

/** A region that is still loading or updating (a data table fetching its rows sets it: `DataTable`). */
export const BUSY_REGION_SELECTOR = '[aria-busy="true"]';

/** Whether nothing in the document is busy. Runs in the page (Playwright serialises it), so it reads only its argument. */
export function hasNoBusyRegion(selector: string): boolean {
	return document.querySelector(selector) === null;
}

/**
 * The serious and critical accessibility problems on `page` once it has loaded (an empty list means none).
 *
 * It first waits until no region is busy, so the check sees the page people use, not one caught mid-load. The
 * suites' `networkidle` is not that signal: on a busy CI runner it fired before the admin's servers page had
 * even requested its data, axe then scanned the Instances table as loading skeletons (2026-11-21), and whether
 * a page was checked loaded or loading depended on timing.
 */
export async function pageAccessibilityViolations(page: AxePage): Promise<readonly AccessibilityViolation[]> {
	await page.waitForFunction(hasNoBusyRegion, BUSY_REGION_SELECTOR);
	const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
	return seriousViolations(results.violations);
}
