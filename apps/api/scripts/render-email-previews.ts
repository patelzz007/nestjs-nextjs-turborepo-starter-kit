/**
 * Dev utility: renders every email template to HTML and screenshots each with
 * headless Chrome, writing the PNGs used by the docs gallery
 * (`docs/images/email/<key>.png`).
 *
 * Why a screenshot step: the docs want to *show* the design. The render is
 * forced to LIGHT mode (the dark-mode `@media` block is stripped from the
 * temp HTML first) because headless Chrome inherits the macOS/OS color-scheme
 * setting — without stripping, a machine in dark mode silently produces
 * dark-render screenshots. The shipped templates keep their dark-mode support;
 * only the preview capture is pinned to light so the gallery is consistent.
 *
 * Usage:
 *   pnpm tsx scripts/render-email-previews.ts
 *
 * Output:
 *   /tmp/email-previews/<key>.html        (standalone HTML, for inspection)
 *   docs/images/email/<key>.png           (1360x1300 screenshot, for the docs)
 *
 * Requires Google Chrome installed at the standard macOS path (edit
 * `CHROME_BIN` below if yours differs).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { EmailRenderContextSchema } from "../src/modules/notifications/email/base/email-render-context.js";
import { EMAIL_TEMPLATE_REGISTRY, type EmailTemplateEntry } from "../src/modules/notifications/email/email-template.registry.js";

const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1360;
const HEIGHT = 1300;

const context = EmailRenderContextSchema.parse({
	appName: "Acme Inc",
	appUrl: "https://app.example.com",
	supportEmail: "support@example.com",
});

const outDir = "/tmp/email-previews";
const pngDir: string = new URL("../../../docs/images/email", import.meta.url).pathname.replace(/\/$/, "");
mkdirSync(outDir, { recursive: true });
mkdirSync(pngDir, { recursive: true });

if (!existsSync(CHROME_BIN)) {
	throw new Error(`Chrome not found at ${CHROME_BIN} — set CHROME_BIN at the top of this script.`);
}

/** Remove the whole `@media (prefers-color-scheme: dark) { … }` block (nested braces). */
function stripDarkMediaBlock(html: string): string {
	const marker = "@media (prefers-color-scheme: dark)";
	let result = html;
	let idx: number = result.indexOf(marker);
	while (idx !== -1) {
		const brace = result.indexOf("{", idx);
		let depth = 0;
		let j = brace;
		while (j < result.length && depth > -1) {
			if (result[j] === "{") {
				depth += 1;
			} else if (result[j] === "}") {
				depth -= 1;
				if (depth === 0) {
					break;
				}
			}
			j += 1;
		}
		result = result.slice(0, idx) + result.slice(j + 1);
		idx = result.indexOf(marker);
	}
}

const entries: readonly EmailTemplateEntry[] = Object.values(EMAIL_TEMPLATE_REGISTRY);
for (const entry of entries) {
	const template = entry.build();
	const rawHtml: string = template.renderHtml(context);

	// Standalone HTML (as-is — keeps dark-mode support for real inspection).
	const htmlFile = `${outDir}/${entry.key}.html`;
	writeFileSync(htmlFile, rawHtml, "utf8");

	// Light-pinned HTML for the screenshot (dark @media block stripped).
	const lightHtml = stripDarkMediaBlock(rawHtml)
		.replace('<meta name="color-scheme" content="light dark">', "")
		.replace('<meta name="supported-color-schemes" content="light dark">', "");
	const lightFile = `${outDir}/${entry.key}.light.html`;
	writeFileSync(lightFile, lightHtml, "utf8");

	const pngFile = `${pngDir}/${entry.key}.png`;
	execFileSync(
		CHROME_BIN,
		[
			"--headless",
			"--disable-gpu",
			"--hide-scrollbars",
			"--force-device-scale-factor=1",
			`--window-size=${String(WIDTH)},${String(HEIGHT)}`,
			`--screenshot=${pngFile}`,
			`file://${lightFile}`,
		],
		{ stdio: "ignore" },
	);

	console.warn(`wrote ${pngFile} (${String(WIDTH)}x${String(HEIGHT)}) from ${htmlFile}`);
}
