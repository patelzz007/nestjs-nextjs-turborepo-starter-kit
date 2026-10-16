import { describe, expect, it } from "vitest";

import { APP_VERSION_MAX_LENGTH, AppVersionSchema, compareAppVersions, type AppVersionOrder } from "./app-version";

describe("AppVersionSchema", () => {
	it.each(["0.0.0", "1.0.0", "1.4.2", "10.20.30", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-0.3.7", "1.0.0-x-y-z.--", "1.4.2+417", "1.0.0-rc.1+build.5"])(
		"accepts the semantic version %s",
		(version: string) => {
			expect(AppVersionSchema.parse(version)).toBe(version);
		},
	);

	it.each(["", "1", "1.0", "v1.0.0", "01.0.0", "1.02.0", "1.0.0-", "1.0.0-01", "1.0.0+", "1.0.0 ", " 1.0.0", "1.0.0.0", "1.0.0-beta..1", "latest"])(
		"rejects the malformed version %j",
		(version: string) => {
			expect(AppVersionSchema.safeParse(version).success).toBe(false);
		},
	);

	it("rejects a version longer than the bound even when it is otherwise well-formed", () => {
		const tooLong = `1.0.0-${"a".repeat(APP_VERSION_MAX_LENGTH)}`;

		expect(AppVersionSchema.safeParse(tooLong).success).toBe(false);
	});
});

describe("compareAppVersions", () => {
	it.each<[string, string, AppVersionOrder]>([
		["1.0.0", "1.0.0", 0],
		["1.0.1", "1.0.0", 1],
		["1.0.0", "1.0.1", -1],
		["1.1.0", "1.0.9", 1],
		["2.0.0", "1.99.99", 1],
		["1.10.0", "1.9.0", 1],
		["0.9.0", "1.0.0", -1],
	])("orders the release %s against %s as %i", (left: string, right: string, expected: AppVersionOrder) => {
		expect(compareAppVersions(left, right)).toBe(expected);
	});

	it("compares numeric parts by value without a precision limit", () => {
		expect(compareAppVersions("1.0.90071992547409930", "1.0.90071992547409929")).toBe(1);
		expect(compareAppVersions("100.0.0", "99.0.0")).toBe(1);
	});

	it.each<[string, string, AppVersionOrder]>([
		["1.0.0-beta", "1.0.0", -1],
		["1.0.0", "1.0.0-rc.1", 1],
		["1.1.0-beta", "1.0.0", 1],
		["1.0.0-alpha", "1.0.0-alpha.1", -1],
		["1.0.0-alpha.1", "1.0.0-alpha.beta", -1],
		["1.0.0-alpha.beta", "1.0.0-beta", -1],
		["1.0.0-beta", "1.0.0-beta.2", -1],
		["1.0.0-beta.2", "1.0.0-beta.11", -1],
		["1.0.0-beta.11", "1.0.0-rc.1", -1],
		["1.0.0-rc.1", "1.0.0-rc.1", 0],
		["1.0.0-Beta", "1.0.0-beta", -1],
	])("follows semver prerelease precedence: %s against %s is %i", (left: string, right: string, expected: AppVersionOrder) => {
		expect(compareAppVersions(left, right)).toBe(expected);
	});

	it("ignores build metadata", () => {
		expect(compareAppVersions("1.4.2+417", "1.4.2")).toBe(0);
		expect(compareAppVersions("1.4.2+1", "1.4.2+2")).toBe(0);
	});

	it("throws for a value that is not a semantic version", () => {
		expect(() => compareAppVersions("1.0", "1.0.0")).toThrow();
		expect(() => compareAppVersions("1.0.0", "next")).toThrow();
	});
});
