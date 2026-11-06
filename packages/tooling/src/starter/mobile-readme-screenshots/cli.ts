#!/usr/bin/env node
// `pnpm --filter @workspace/mobile screenshots:device [-- --theme Nord]`: retakes the root README's mobile
// screenshots (docs/images/readme/mobile-*.webp) from the app on the connected phone or emulator, signed in.
// The status bar is put in Android's demo mode for the run (noon, full battery, no notification icons) and the
// phone's notifications are silenced (no banner can land in a screenshot), both put back afterwards; the flow changes the app's theme and puts `--theme` back at the end (the phone's own
// theme: the default is System). It signs out for the sign-in screens and back in with MAESTRO_EMAIL and
// MAESTRO_PASSWORD (the emailed code, if asked for, comes from Mailpit). Run from apps/mobile. Needs `maestro`, `adb` and `cwebp` (brew install webp).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { mailpitUrlOf, maestroEnv, metroLinkArgs } from "../mobile-device-tests/mobile-device-tests.ts";
import {
	appIdentityOf,
	assertSignInEnvironment,
	demoAllowedOf,
	demoModeOffArgs,
	demoModeOnArgs,
	notificationsRestoreArgs,
	notificationsSilentArgs,
	notificationStateOf,
	restoreThemeOf,
	screenshotMaestroArgs,
	screenshotsOf,
	webpArgs,
} from "./mobile-readme-screenshots.ts";

const README_IMAGES = path.resolve(import.meta.dirname, "../../../../../docs/images/readme");

const restoreTheme = restoreThemeOf(process.argv.slice(2));
assertSignInEnvironment(process.env);
const config = spawnSync("npx", ["expo", "config", "--type", "public", "--json"], { encoding: "utf8" });
if (config.status !== 0) {
	process.stderr.write(config.stderr);
	process.exit(config.status ?? 1);
}
const identity = appIdentityOf(config.stdout);
spawnSync("adb", metroLinkArgs(), { stdio: "inherit" });

const adbSetting = (name: string): string => spawnSync("adb", ["shell", "settings", "get", "global", name], { encoding: "utf8" }).stdout;
const previouslyAllowed = demoAllowedOf(adbSetting("sysui_demo_allowed"));
const previousNotifications = notificationStateOf(adbSetting("heads_up_notifications_enabled"), adbSetting("zen_mode"));
const shotDir = mkdtempSync(path.join(tmpdir(), "mobile-readme-"));
let status = 1;
// Ctrl-C stops Maestro, and without a handler this script too, before `finally` puts the phone back.
process.on("SIGINT", () => undefined);
try {
	for (const args of [...notificationsSilentArgs(), ...demoModeOnArgs()]) {
		spawnSync("adb", args, { stdio: "ignore" });
	}
	status =
		spawnSync("maestro", screenshotMaestroArgs(identity, shotDir, restoreTheme, mailpitUrlOf(process.env)), { stdio: "inherit", env: maestroEnv(process.env) }).status ?? 1;
} finally {
	for (const args of [...demoModeOffArgs(previouslyAllowed), ...notificationsRestoreArgs(previousNotifications)]) {
		spawnSync("adb", args, { stdio: "ignore" });
	}
}
if (status !== 0) {
	process.stderr.write(`The flow failed; the screenshots it took are in ${shotDir} and the README's are unchanged.\n`);
	process.exit(status);
}
const screenshots = screenshotsOf(readdirSync(shotDir, { recursive: true, encoding: "utf8" }));
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
