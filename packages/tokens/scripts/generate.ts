// ============================================
// scripts/generate.ts — `pnpm tokens:generate`
// ============================================
// Writes every generated file into packages/tokens/generated/, then copies the
// icons to each app that serves them (a test in each app fails while its copy
// differs — ADR 040). The output is deterministic, so running it twice changes
// nothing; commit what it writes. Exits non-zero (the generator throws) on any
// invalid token.

import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateTokenStylesheets } from "../src/generator/generate";
import { TOKEN_SOURCE } from "../src/source";

const GENERATED_DIRECTORY = new URL("../generated/", import.meta.url);
const REPOSITORY_ROOT = new URL("../../../", import.meta.url);

/**
 * Where each app serves the generated icons from (generated file → its path in the
 * repository): Next's file conventions in `app/` (`icon.svg`, `favicon.ico`,
 * `apple-icon.png`), the docs site's `public/`.
 */
/** Each Next app's icon tone: the colour of its own sign-in tile (`--auth-brand-from` in its theme CSS). */
const NEXT_APP_ICON_SUFFIXES: readonly (readonly [string, string])[] = [
	["web", "-blue"],
	["merchant", "-green"],
	["admin", ""],
];

const ICON_COPIES: readonly (readonly [string, string])[] = NEXT_APP_ICON_SUFFIXES.flatMap(([app, suffix]): readonly (readonly [string, string])[] => [
	[`favicon${suffix}.svg`, `apps/${app}/app/icon.svg`],
	[`favicon${suffix}.ico`, `apps/${app}/app/favicon.ico`],
	[`apple-touch-icon${suffix}.png`, `apps/${app}/app/apple-icon.png`],
]).concat([
	["favicon.svg", "apps/docs/public/favicon.svg"],
	["favicon.ico", "apps/docs/public/favicon.ico"],
	["apple-touch-icon.png", "apps/docs/public/apple-touch-icon.png"],
	// The Expo app's launch assets (ADR 043).
	["app-icon.png", "apps/mobile/assets/app-icon.png"],
	["splash-icon.png", "apps/mobile/assets/splash-icon.png"],
	["launch-colors.json", "apps/mobile/assets/launch-colors.json"],
]);

function main(): void {
	mkdirSync(GENERATED_DIRECTORY, { recursive: true });
	for (const { fileName, contents } of generateTokenStylesheets(TOKEN_SOURCE)) {
		const target = new URL(fileName, GENERATED_DIRECTORY);
		writeFileSync(target, contents, "utf8");
		process.stdout.write(`wrote ${fileURLToPath(target)}\n`);
	}
	for (const [fileName, copy] of ICON_COPIES) {
		const target = new URL(copy, REPOSITORY_ROOT);
		copyFileSync(new URL(fileName, GENERATED_DIRECTORY), target);
		process.stdout.write(`copied ${fileName} to ${fileURLToPath(target)}\n`);
	}
}

main();
