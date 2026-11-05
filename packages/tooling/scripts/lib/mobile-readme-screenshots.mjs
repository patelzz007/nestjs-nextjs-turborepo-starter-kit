/**
 * The pieces of `pnpm --filter @workspace/mobile screenshots:device`: the root README's mobile screenshots,
 * taken by the Maestro flow apps/mobile/.maestro/screenshots/readme.yaml on a connected phone or emulator.
 * Pure, so unit-tested without one.
 */

import path from "node:path";

import { z } from "zod";

/** The flow, relative to apps/mobile. */
export const SCREENSHOT_FLOW = ".maestro/screenshots/readme.yaml";

/** The theme put back after the run when `--theme` is not given (the Appearance screen's own name). */
export const DEFAULT_RESTORE_THEME = "System";

/** The Appearance screen's theme names: the flow taps one by its exact label. */
export const THEME_NAMES = ["System", "Light", "Dark", "Nord"];

/** The README shows each phone screenshot at half a 1080-pixel phone's width (its 4-column tables). */
export const README_IMAGE_WIDTH = 540;

/** cwebp's quality: screens are mostly flat colour and text, which stays sharp well below 100. */
export const README_IMAGE_QUALITY = 82;

/** The status bar the screenshots show (Android's SystemUI demo mode): noon, full battery, full signal, no icons. */
export const DEMO_CLOCK = "1200";
const DEMO_LEVEL_FULL = "4";
const DEMO_BATTERY_FULL = "100";

const PublicConfigSchema = z.object({ scheme: z.string().min(1), android: z.object({ package: z.string().min(1) }) });

/** The app's Android id and URL scheme, from `expo config --type public --json` (read from its config, never typed here). */
export function appIdentityOf(configJson) {
	const config = PublicConfigSchema.parse(JSON.parse(configJson));
	return { appId: config.android.package, scheme: config.scheme };
}

/** `--theme <name>` from the script's arguments, or the default; any other name is refused before the phone is touched. */
export function restoreThemeOf(argv) {
	const flag = argv.indexOf("--theme");
	const theme = flag === -1 ? DEFAULT_RESTORE_THEME : argv.at(flag + 1);
	return z.enum(THEME_NAMES).parse(theme);
}

/**
 * `maestro test`'s arguments for the screenshot flow. Maestro writes a `takeScreenshot` only inside the run's
 * output folder, so the flow names each screenshot and `--test-output-dir` says where they go.
 */
export function screenshotMaestroArgs({ appId, scheme }, shotDir, restoreTheme) {
	return ["test", SCREENSHOT_FLOW, "--test-output-dir", shotDir, "-e", `APP_ID=${appId}`, "-e", `SCHEME=${scheme}`, "-e", `RESTORE_THEME=${restoreTheme}`];
}

function demoBroadcast(command, extras) {
	return ["shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", command, ...extras.flatMap(([key, value]) => ["-e", key, value])];
}

/** `adb` argument lists that turn the status bar's demo mode on, in order. */
export function demoModeOnArgs() {
	return [
		["shell", "settings", "put", "global", "sysui_demo_allowed", "1"],
		demoBroadcast("enter", []),
		demoBroadcast("clock", [["hhmm", DEMO_CLOCK]]),
		demoBroadcast("battery", [
			["level", DEMO_BATTERY_FULL],
			["plugged", "false"],
		]),
		demoBroadcast("network", [
			["wifi", "show"],
			["level", DEMO_LEVEL_FULL],
			["mobile", "show"],
		]),
		demoBroadcast("notifications", [["visible", "false"]]),
	];
}

/** `adb` argument lists that turn it off again and put the phone's own setting back. */
export function demoModeOffArgs(previouslyAllowed) {
	return [demoBroadcast("exit", []), ["shell", "settings", "put", "global", "sysui_demo_allowed", previouslyAllowed]];
}

/** `settings get` prints "null" for a setting never written: that is the same as off. */
export function demoAllowedOf(settingsOutput) {
	const value = settingsOutput.trim();
	return value === "1" ? "1" : "0";
}

/**
 * The screenshots the flow took, from a recursive listing of the output folder (Maestro files them under
 * `<run>/<flow name>/takeScreenshot/`, beside its logs): each one's path and its README name (Maestro adds `.png`).
 */
export function screenshotsOf(relativePaths) {
	return relativePaths
		.filter((file) => path.basename(path.dirname(file)) === "takeScreenshot" && file.endsWith(".png"))
		.map((file) => ({ file, name: path.basename(file, ".png") }));
}

/** `cwebp`'s arguments: one PNG to a README-sized WebP. */
export function webpArgs(pngPath, webpPath) {
	return ["-quiet", "-q", String(README_IMAGE_QUALITY), "-resize", String(README_IMAGE_WIDTH), "0", pngPath, "-o", webpPath];
}
