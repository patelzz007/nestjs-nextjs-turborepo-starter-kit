import { describe, expect, it } from "vitest";

import {
	appIdentityOf,
	demoAllowedOf,
	demoModeOffArgs,
	demoModeOnArgs,
	restoreThemeOf,
	screenshotMaestroArgs,
	screenshotsOf,
	webpArgs,
} from "../mobile-readme-screenshots.mjs";

describe("mobile README screenshots", () => {
	it("reads the app's Android id and URL scheme from its public config, and refuses a config without them", () => {
		expect(appIdentityOf(JSON.stringify({ scheme: "starter", android: { package: "com.example.starter" } }))).toEqual({ appId: "com.example.starter", scheme: "starter" });
		expect(() => appIdentityOf(JSON.stringify({ android: { package: "com.example.starter" } }))).toThrow();
		expect(() => appIdentityOf(JSON.stringify({ scheme: "starter" }))).toThrow();
	});

	it("puts back System unless --theme names one of the Appearance screen's themes", () => {
		expect(restoreThemeOf([])).toBe("System");
		expect(restoreThemeOf(["--", "--theme", "Nord"])).toBe("Nord");
		expect(() => restoreThemeOf(["--theme", "nord"])).toThrow();
		expect(() => restoreThemeOf(["--theme"])).toThrow();
	});

	it("runs only the screenshot flow, with the app, its scheme, the output folder and the theme to restore", () => {
		expect(screenshotMaestroArgs({ appId: "com.example.starter", scheme: "starter" }, "/tmp/shots", "Dark")).toEqual([
			"test",
			".maestro/screenshots/readme.yaml",
			"--test-output-dir",
			"/tmp/shots",
			"-e",
			"APP_ID=com.example.starter",
			"-e",
			"SCHEME=starter",
			"-e",
			"RESTORE_THEME=Dark",
		]);
	});

	it("turns demo mode on with a fixed clock and no notification icons, then off with the phone's own setting", () => {
		const on = demoModeOnArgs();
		expect(on.at(0)).toEqual(["shell", "settings", "put", "global", "sysui_demo_allowed", "1"]);
		expect(on).toContainEqual(["shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", "clock", "-e", "hhmm", "1200"]);
		expect(on).toContainEqual(["shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", "notifications", "-e", "visible", "false"]);
		expect(demoModeOffArgs("0")).toEqual([
			["shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", "exit"],
			["shell", "settings", "put", "global", "sysui_demo_allowed", "0"],
		]);
	});

	it("treats a never-written demo setting as off", () => {
		expect(demoAllowedOf("1\n")).toBe("1");
		expect(demoAllowedOf("0\n")).toBe("0");
		expect(demoAllowedOf("null\n")).toBe("0");
	});

	it("finds each screenshot under Maestro's run folders, ignoring its logs and failure captures", () => {
		expect(
			screenshotsOf([
				"2026-11-05_050608",
				"2026-11-05_050608/README screenshots/commands.json",
				"2026-11-05_050608/README screenshots/logs/maestro.log",
				"2026-11-05_050608/README screenshots/takeScreenshot/mobile-home.png",
				"2026-11-05_050608/README screenshots/takeScreenshot/mobile-home-dark.png",
				"2026-11-05_050608/README screenshots/screenshot-failed.png",
			]),
		).toEqual([
			{ file: "2026-11-05_050608/README screenshots/takeScreenshot/mobile-home.png", name: "mobile-home" },
			{ file: "2026-11-05_050608/README screenshots/takeScreenshot/mobile-home-dark.png", name: "mobile-home-dark" },
		]);
	});

	it("converts to a 540-pixel-wide WebP, keeping the aspect ratio", () => {
		expect(webpArgs("/tmp/a.png", "/out/a.webp")).toEqual(["-quiet", "-q", "82", "-resize", "540", "0", "/tmp/a.png", "-o", "/out/a.webp"]);
	});
});
