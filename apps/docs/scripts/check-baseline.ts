/**
 * After `vite build`: compares the pre-rendered site (dist/client) with the baseline captured from the
 * last Astro build (regression-baseline/routes.json) and fails the build on any regression — a page, file,
 * title, heading, sharing image, canonical path or heading anchor that no longer matches. Logic and tests:
 * src/lib/baseline.ts. Runs on Node's built-in TypeScript support (no build step).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { BaselineSchema, compareWithBaseline, snapshotOf, type PageSnapshot } from "../src/lib/baseline.ts";

const APP_ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT = path.join(APP_ROOT, "dist/client");
const baseline = BaselineSchema.parse(JSON.parse(readFileSync(path.join(APP_ROOT, "regression-baseline/routes.json"), "utf8")));

const files = readdirSync(OUTPUT, { recursive: true, encoding: "utf8" }).map((file) => `/${file.replace(/\\/g, "/")}`);
const pages = new Map<string, PageSnapshot>(
	files
		.filter((file) => file.endsWith(".html"))
		.map((file): [string, PageSnapshot] => {
			const route = file.replace(/\.html$/, "").replace(/^\/index$/, "/");
			return [route, snapshotOf(readFileSync(path.join(OUTPUT, file), "utf8"))];
		}),
);
const problems = compareWithBaseline(baseline, pages, new Set(files));

if (problems.length > 0) {
	console.error(`✗ ${String(problems.length)} regression(s) against the Astro baseline:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
	process.exitCode = 1;
} else {
	process.stdout.write(
		`✓ Every one of the ${String(Object.keys(baseline.pages).length)} baseline pages and ${String(baseline.files.length)} files is still served, with its title, heading, sharing image and anchors.\n`,
	);
}
