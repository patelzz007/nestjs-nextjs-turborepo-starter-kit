#!/usr/bin/env node
// `pnpm --filter @workspace/mobile screenshots:device [-- --theme Nord]`: retakes the root README's mobile
// screenshots (docs/images/readme/mobile-*.webp) from the app on the connected phone or emulator, signed in.
// The status bar is put in Android's demo mode for the run (noon, full battery, no notification icons) and
// back afterwards; the flow changes the app's theme and puts `--theme` back at the end (the phone's own
// theme: the default is System). Run from apps/mobile. Needs `maestro`, `adb` and `cwebp` (brew install webp).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { maestroEnv, metroLinkArgs } from "./lib/mobile-device-tests.mjs";
import {
	appIdentityOf,
	demoAllowedOf,
	demoModeOffArgs,
	demoModeOnArgs,
	restoreThemeOf,
	screenshotMaestroArgs,
	screenshotsOf,
	webpArgs,
} from "./lib/mobile-readme-screenshots.mjs";

const README_IMAGES = path.resolve(import.meta.dirname, "../../../docs/images/readme");

const restoreTheme = restoreThemeOf(process.argv.slice(2));
const config = spawnSync("npx", ["expo", "config", "--type", "public", "--json"], { encoding: "utf8" });
if (config.status !== 0) {
	process.stderr.write(config.stderr);
	process.exit(config.status ?? 1);
}
const identity = appIdentityOf(config.stdout);
spawnSync("adb", metroLinkArgs(), { stdio: "inherit" });

const previouslyAllowed = demoAllowedOf(spawnSync("adb", ["shell", "settings", "get", "global", "sysui_demo_allowed"], { encoding: "utf8" }).stdout);
const shotDir = mkdtempSync(path.join(tmpdir(), "mobile-readme-"));
let status = 1;
try {
	for (const args of demoModeOnArgs()) {
		spawnSync("adb", args, { stdio: "ignore" });
	}
	status = spawnSync("maestro", screenshotMaestroArgs(identity, shotDir, restoreTheme), { stdio: "inherit", env: maestroEnv(process.env) }).status ?? 1;
} finally {
	for (const args of demoModeOffArgs(previouslyAllowed)) {
		spawnSync("adb", args, { stdio: "ignore" });
	}
}
if (status !== 0) {
	process.stderr.write(`The flow failed; the screenshots it took are in ${shotDir} and the README's are unchanged.\n`);
	process.exit(status);
}
const screenshots = screenshotsOf(readdirSync(shotDir, { recursive: true }));
if (screenshots.length === 0) {
	process.stderr.write(`The flow passed but no screenshot is in ${shotDir}; the README's are unchanged.\n`);
	process.exit(1);
}
for (const { file, name } of screenshots) {
	const converted = spawnSync("cwebp", webpArgs(path.join(shotDir, file), path.join(README_IMAGES, `${name}.webp`)), { stdio: "inherit" });
	if (converted.status !== 0) {
		process.exit(converted.status ?? 1);
	}
	process.stdout.write(`docs/images/readme/${name}.webp\n`);
}
