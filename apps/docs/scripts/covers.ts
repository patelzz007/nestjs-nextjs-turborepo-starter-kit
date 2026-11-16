/**
 * `pnpm docs:covers [slug-prefix …]` — draws every guide's cover (`src/lib/covers/`) in Chromium and writes it
 * where the guide's front matter points: `docs/images/covers/<slug>.webp`, plus the Notion home page's cover.
 * With prefixes (`adr/08`, `technical/api`), only the matching covers are redrawn.
 *
 * Reads the README screenshots (`docs/images/readme/`), so retake those first after a visible UI change.
 * Offline and deterministic; commit the images, then `pnpm docs:import` to send them to Notion.
 */
import { mkdirSync, mkdtempSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";
import sharp from "sharp";

import { readCoverGuides } from "../src/lib/covers/cover-guides";
import { COVER_HEIGHT, COVER_WIDTH, coverHtml, type CoverAssets } from "../src/lib/covers/cover-html";
import { COVER_EXTENSION, coverSpec, coverUrl, NOTION_HOME_SPEC, type CoverSpec } from "../src/lib/covers/cover-spec";

const APP_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DOCS_ROOT = fileURLToPath(new URL("../../../docs/", import.meta.url));
const COVERS_ROOT = `${DOCS_ROOT}images/covers/`;
/** 1.5× density: the 1600 × 840 page becomes a 2400 × 1260 image, sharp on a retina screen at the docs' widest. */
const COVER_SCALE = 1.5;
const WEBP_QUALITY = 80;
const BYTES_PER_KILOBYTE = 1024;

const ASSETS: CoverAssets = {
	fontSans: pathToFileURL(`${APP_ROOT}node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2`).href,
	fontMono: pathToFileURL(`${APP_ROOT}node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2`).href,
	screenshot: (name: string): string => pathToFileURL(`${DOCS_ROOT}images/readme/${name}.webp`).href,
};

/** Every cover to draw: each guide's, then the Notion home page's; only those under `prefixes` when any are given. */
function coverSpecs(prefixes: readonly string[]): readonly CoverSpec[] {
	const guides = readCoverGuides(DOCS_ROOT);
	const misnamed = guides.filter((guide) => guide.cover !== coverUrl(guide.slug));
	if (misnamed.length > 0) {
		throw new Error(`These guides must name their own cover (coverImage: "${coverUrl("<slug>")}"):\n${misnamed.map((guide) => `  ${guide.slug}`).join("\n")}`);
	}
	const specs = [...guides.map(coverSpec), NOTION_HOME_SPEC];
	return prefixes.length === 0 ? specs : specs.filter((spec) => prefixes.some((prefix) => spec.slug.startsWith(prefix)));
}

async function main(prefixes: readonly string[]): Promise<void> {
	const specs = coverSpecs(prefixes);
	const renderDirectory = mkdtempSync(path.join(tmpdir(), "docs-covers-"));
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ viewport: { width: COVER_WIDTH, height: COVER_HEIGHT }, deviceScaleFactor: COVER_SCALE });
		for (const spec of specs) {
			const htmlFile = path.join(renderDirectory, "cover.html");
			writeFileSync(htmlFile, await coverHtml(spec, ASSETS), "utf8");
			await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "load" });
			await page.evaluate(async (): Promise<void> => {
				await document.fonts.ready;
			});
			const output = `${COVERS_ROOT}${spec.slug}${COVER_EXTENSION}`;
			mkdirSync(path.dirname(output), { recursive: true });
			await sharp(await page.screenshot({ type: "png" }))
				.webp({ quality: WEBP_QUALITY })
				.toFile(output);
			unlinkSync(htmlFile);
			process.stdout.write(
				`cover  docs/images/covers/${spec.slug}${COVER_EXTENSION}  ${spec.detail.kind} on ${spec.screenshot}  (${String(Math.round(statSync(output).size / BYTES_PER_KILOBYTE))} KB)\n`,
			);
		}
		process.stdout.write(`${String(specs.length)} cover(s) drawn.\n`);
	} finally {
		await browser.close();
	}
}

await main(process.argv.slice(2));
