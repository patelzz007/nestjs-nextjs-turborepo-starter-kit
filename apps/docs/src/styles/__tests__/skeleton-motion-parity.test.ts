import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * The docs load the UI kit's stylesheet, so their one skeleton (a diagram while it renders) uses the
 * kit's sweep: its `skeleton-sweep` keyframes and `--skeleton-sweep-duration` token (held to
 * SKELETON_MOTION by the kit's own parity test), and the same sheen gradient as `.skeleton-bone`.
 * The docs never define a sweep of their own.
 */
const require = createRequire(import.meta.url);
const DOCS_CSS = readFileSync(new URL("../app.css", import.meta.url), "utf8");
const KIT_CSS = readFileSync(require.resolve("@workspace/ui/globals.css").replace(/globals\.css$/, "components.css"), "utf8");

function declaration(css: string, property: string, after: string): string {
	const start = css.indexOf(after);
	const match = new RegExp(`${property}:\\s*(?<value>[^;]+);`).exec(css.slice(start));
	return match?.groups?.value ?? "";
}

describe("docs skeleton follows the kit's sweep", () => {
	it("animates with the kit's keyframes and timing token", () => {
		expect(declaration(DOCS_CSS, "animation", '.diagram[aria-busy="true"] .diagram-source')).toBe(declaration(KIT_CSS, "animation", ".skeleton-bone {"));
		expect(DOCS_CSS).not.toContain("@keyframes skeleton-sweep");
	});

	it("draws the kit's sheen band", () => {
		for (const property of ["background-image", "background-size", "background-attachment"]) {
			expect(declaration(DOCS_CSS, property, '.diagram[aria-busy="true"] .diagram-source')).toBe(declaration(KIT_CSS, property, ".skeleton-bone {"));
		}
	});
});
