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
export const THEME_NAMES = ["System", "Light", "Dark", "Nord", "Current Dark", "Harbour", "Mocha"];

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
export function appIdentityOf(configJson: string): { appId: string; scheme: string } {
	const config = PublicConfigSchema.parse(JSON.parse(configJson));
	return { appId: config.android.package, scheme: config.scheme };
}

/** `--theme <name>` from the script's arguments, or the default; any other name is refused before the phone is touched. */
export function restoreThemeOf(argv: readonly string[]): string {
	const flag = argv.indexOf("--theme");
	const theme = flag === -1 ? DEFAULT_RESTORE_THEME : argv.at(flag + 1);
	return z.enum(THEME_NAMES).parse(theme);
}

/**
 * `maestro test`'s arguments for the screenshot flow. Maestro writes a `takeScreenshot` only inside the run's
 * output folder, so the flow names each screenshot and `--test-output-dir` says where they go.
 */
export function screenshotMaestroArgs(
	{ appId, scheme }: { readonly appId: string; readonly scheme: string },
	shotDir: string,
	restoreTheme: string,
	mailpitUrl: string,
): string[] {
	return [
		"test",
		SCREENSHOT_FLOW,
		"--test-output-dir",
		shotDir,
		"-e",
		`APP_ID=${appId}`,
		"-e",
		`SCHEME=${scheme}`,
		"-e",
		`RESTORE_THEME=${restoreTheme}`,
		"-e",
		`MAILPIT_URL=${mailpitUrl}`,
	];
}

const SignInEnvironmentSchema = z.object({ MAESTRO_EMAIL: z.email(), MAESTRO_PASSWORD: z.string().min(1) });

/** The flow signs out for the sign-in screens and back in afterwards: refuse to start without what it signs in with. */
export function assertSignInEnvironment(environment: NodeJS.ProcessEnv): void {
	SignInEnvironmentSchema.parse(environment);
}

function demoBroadcast(command: string, extras: readonly (readonly [string, string])[]): string[] {
	return ["shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", command, ...extras.flatMap(([key, value]) => ["-e", key, value])];
}

/** `adb` argument lists that turn the status bar's demo mode on, in order. */
export function demoModeOnArgs(): string[][] {
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
export function demoModeOffArgs(previouslyAllowed: string): string[][] {
	return [demoBroadcast("exit", []), ["shell", "settings", "put", "global", "sysui_demo_allowed", previouslyAllowed]];
}

/** `settings get` prints "null" for a setting never written: that is the same as off. */
export function demoAllowedOf(settingsOutput: string): "0" | "1" {
	const value = settingsOutput.trim();
	return value === "1" ? "1" : "0";
}

/** Android's `heads_up_notifications_enabled`: banners that drop over the app, whatever demo mode does to the status bar. */
const HEADS_UP_SETTING = "heads_up_notifications_enabled";
const HEADS_UP_ON = "1";
const HEADS_UP_OFF = "0";

/** Android's `zen_mode` values, by the word `cmd notification set_dnd` takes for each: Do Not Disturb as the phone had it. */
const DO_NOT_DISTURB_OF_ZEN_MODE = new Map([
	["0", "off"],
	["1", "priority"],
	["2", "none"],
	["3", "alarms"],
]);
const DO_NOT_DISTURB_SILENT = "none";
const DO_NOT_DISTURB_OFF = "off";

/** What the phone's notifications were set to before the run, from `settings get`'s output ("null" for a setting never written). */
export function notificationStateOf(headsUpOutput: string, zenModeOutput: string): { headsUp: string; doNotDisturb: string } {
	return {
		headsUp: headsUpOutput.trim() === HEADS_UP_OFF ? HEADS_UP_OFF : HEADS_UP_ON,
		doNotDisturb: DO_NOT_DISTURB_OF_ZEN_MODE.get(zenModeOutput.trim()) ?? DO_NOT_DISTURB_OFF,
	};
}

/**
 * `adb` argument lists that keep the phone's own notifications out of the screenshots. Demo mode hides the status
 * bar's icons only: a message arriving mid-run still drops its banner, with the sender and the text, over the app.
 */
export function notificationsSilentArgs(): string[][] {
	return [
		["shell", "settings", "put", "global", HEADS_UP_SETTING, HEADS_UP_OFF],
		["shell", "cmd", "notification", "set_dnd", DO_NOT_DISTURB_SILENT],
	];
}

/** `adb` argument lists that put the phone's notifications back as `notificationStateOf` found them. */
export function notificationsRestoreArgs({ headsUp, doNotDisturb }: { readonly headsUp: string; readonly doNotDisturb: string }): string[][] {
	return [
		["shell", "cmd", "notification", "set_dnd", doNotDisturb],
		["shell", "settings", "put", "global", HEADS_UP_SETTING, headsUp],
	];
}

/**
 * The screenshots the flow took, from a recursive listing of the output folder (Maestro files them under
 * `<run>/<flow name>/takeScreenshot/`, beside its logs): each one's path and its README name (Maestro adds `.png`).
 */
export function screenshotsOf(relativePaths: readonly string[]): { file: string; name: string }[] {
	return relativePaths
		.filter((file) => path.basename(path.dirname(file)) === "takeScreenshot" && file.endsWith(".png"))
		.map((file) => ({ file, name: path.basename(file, ".png") }));
}

/** `cwebp`'s arguments: one PNG to a README-sized WebP. */
export function webpArgs(pngPath: string, webpPath: string): string[] {
	return ["-quiet", "-q", String(README_IMAGE_QUALITY), "-resize", String(README_IMAGE_WIDTH), "0", pngPath, "-o", webpPath];
}
