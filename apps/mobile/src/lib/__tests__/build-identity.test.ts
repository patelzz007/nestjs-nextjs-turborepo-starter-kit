import { formatBuildMoment, resolveBuildKind, resolveBuildMoment } from "../build-identity";

/** Noon UTC: the same calendar day in every time zone from UTC−11 to UTC+11. */
const NOON_UTC = new Date("2026-11-05T12:00:00Z");
const EARLIER = new Date("2026-11-01T08:00:00Z");

describe("resolveBuildKind", () => {
	it("is development whenever the build is debugging, whatever its channel", () => {
		expect(resolveBuildKind({ isDevelopment: true, channel: null })).toBe("development");
		expect(resolveBuildKind({ isDevelopment: true, channel: "production" })).toBe("development");
	});

	it("names a release build by its EAS profile's channel", () => {
		expect(resolveBuildKind({ isDevelopment: false, channel: "development" })).toBe("development");
		expect(resolveBuildKind({ isDevelopment: false, channel: "preview" })).toBe("preview");
		expect(resolveBuildKind({ isDevelopment: false, channel: "production" })).toBe("production");
	});

	it("calls a release with no channel, or one no profile has, a local release", () => {
		expect(resolveBuildKind({ isDevelopment: false, channel: null })).toBe("local");
		expect(resolveBuildKind({ isDevelopment: false, channel: "staging" })).toBe("local");
		expect(resolveBuildKind({ isDevelopment: false, channel: "local" })).toBe("local");
	});
});

describe("resolveBuildMoment", () => {
	it("is the build's own moment while the embedded update runs, ahead of the install time", () => {
		expect(resolveBuildMoment({ runningUpdateCreatedAt: NOON_UTC, isEmbeddedLaunch: true, installedAt: EARLIER })).toEqual({ kind: "built", at: NOON_UTC });
	});

	it("is the update's moment after an over-the-air update", () => {
		expect(resolveBuildMoment({ runningUpdateCreatedAt: NOON_UTC, isEmbeddedLaunch: false, installedAt: EARLIER })).toEqual({ kind: "updated", at: NOON_UTC });
	});

	it("falls back to the install time when no update runs (a development build), else none", () => {
		expect(resolveBuildMoment({ runningUpdateCreatedAt: null, isEmbeddedLaunch: true, installedAt: EARLIER })).toEqual({ kind: "installed", at: EARLIER });
		expect(resolveBuildMoment({ runningUpdateCreatedAt: null, isEmbeddedLaunch: true, installedAt: null })).toBeNull();
	});
});

describe("formatBuildMoment", () => {
	it("gives the day, month, year and time, and names the phone's time zone", () => {
		const shown = formatBuildMoment(NOON_UTC, "en");
		const zone = new Intl.DateTimeFormat("en", { timeZoneName: "short" })
			.formatToParts(NOON_UTC)
			.find((part: Intl.DateTimeFormatPart): boolean => part.type === "timeZoneName")?.value;

		expect(shown).toMatch(/5.*Nov.*2026|Nov.*5.*2026/u);
		expect(zone).toBeDefined();
		expect(shown).toContain(zone);
	});

	it("follows the language on screen", () => {
		expect(formatBuildMoment(NOON_UTC, "zh-Hans")).toContain("2026年11月5日");
	});
});
