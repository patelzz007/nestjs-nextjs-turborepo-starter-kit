import { z } from "zod";

// ── Mobile app version (ADR 033) ────────────────────────────────────────────
//
// The mobile app declares its version in `X-App-Version` on every request; the
// API compares it with `MOBILE_MIN_SUPPORTED_VERSION` and answers an older,
// missing or malformed one with 426 `APP_VERSION_UNSUPPORTED`. Both values
// are Semantic Versioning 2.0.0 strings, compared by semver precedence.

/** Upper bound on a declared app version — a version is an identifier, not prose. */
export const APP_VERSION_MAX_LENGTH = 64;

/**
 * Semantic Versioning 2.0.0 (https://semver.org), the official pattern with
 * named groups: `MAJOR.MINOR.PATCH`, an optional `-prerelease` and an
 * optional `+build`. No leading `v`, no leading zeros in numeric parts.
 */
const SEMVER_PATTERN =
	/^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<build>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** A numeric semver identifier (no leading zeros — the pattern above already enforces that). */
const NUMERIC_IDENTIFIER_PATTERN = /^(?:0|[1-9]\d*)$/;

/** A mobile app version: a semantic version such as `1.4.2`, `2.0.0-beta.3` or `1.4.2+417`. */
export const AppVersionSchema = z
	.string()
	.max(APP_VERSION_MAX_LENGTH)
	.regex(SEMVER_PATTERN, "must be a semantic version: MAJOR.MINOR.PATCH, optionally followed by -prerelease and/or +build")
	.meta({ description: "Semantic version of the installed mobile app", example: "1.4.2" });

export type AppVersion = z.output<typeof AppVersionSchema>;

/** Result of {@link compareAppVersions}: negative = older, `0` = same precedence, positive = newer. */
export type AppVersionOrder = -1 | 0 | 1;

const OLDER: AppVersionOrder = -1;
const SAME: AppVersionOrder = 0;
const NEWER: AppVersionOrder = 1;

interface ParsedAppVersion {
	readonly core: readonly string[];
	readonly prerelease: readonly string[];
}

function parseAppVersion(version: string): ParsedAppVersion {
	const groups = SEMVER_PATTERN.exec(AppVersionSchema.parse(version))?.groups;
	const major: string = groups?.major ?? "";
	const minor: string = groups?.minor ?? "";
	const patch: string = groups?.patch ?? "";
	const prerelease: string | undefined = groups?.prerelease;
	return { core: [major, minor, patch], prerelease: prerelease === undefined ? [] : prerelease.split(".") };
}

function orderOf(difference: number): AppVersionOrder {
	if (difference < 0) return OLDER;
	if (difference > 0) return NEWER;
	return SAME;
}

/** ASCII order, as semver requires for alphanumeric identifiers (never locale order). */
function compareAsciiIdentifiers(left: string, right: string): AppVersionOrder {
	if (left === right) return SAME;
	return left < right ? OLDER : NEWER;
}

/** Numeric identifiers carry no leading zeros, so a longer one is larger and equal lengths compare digit by digit (no precision limit). */
function compareNumericIdentifiers(left: string, right: string): AppVersionOrder {
	if (left.length !== right.length) {
		return orderOf(left.length - right.length);
	}
	return compareAsciiIdentifiers(left, right);
}

/** Semver §11.4.1–11.4.3: numeric < alphanumeric; numerics by value; alphanumerics in ASCII order. */
function comparePrereleaseIdentifiers(left: string, right: string): AppVersionOrder {
	const isLeftNumeric: boolean = NUMERIC_IDENTIFIER_PATTERN.test(left);
	const isRightNumeric: boolean = NUMERIC_IDENTIFIER_PATTERN.test(right);
	if (isLeftNumeric && isRightNumeric) return compareNumericIdentifiers(left, right);
	if (isLeftNumeric) return OLDER;
	if (isRightNumeric) return NEWER;
	return compareAsciiIdentifiers(left, right);
}

function comparePrerelease(left: readonly string[], right: readonly string[]): AppVersionOrder {
	// Semver §11.3: a version WITHOUT a prerelease ranks above the same version with one.
	if (left.length === 0 || right.length === 0) {
		return orderOf(right.length - left.length);
	}
	const shared: number = Math.min(left.length, right.length);
	for (let index = 0; index < shared; index += 1) {
		const order: AppVersionOrder = comparePrereleaseIdentifiers(left.at(index) ?? "", right.at(index) ?? "");
		if (order !== SAME) return order;
	}
	// Semver §11.4.4: a longer set of identifiers ranks higher when every shared one is equal.
	return orderOf(left.length - right.length);
}

/**
 * Compares two app versions by semver precedence (https://semver.org §11):
 * `MAJOR.MINOR.PATCH` numerically, then the prerelease (`1.0.0-beta` <
 * `1.0.0`); build metadata (`+417`) is ignored. Throws a `ZodError` when
 * either value is not a semantic version — validate untrusted input with
 * {@link AppVersionSchema} first.
 */
export function compareAppVersions(left: string, right: string): AppVersionOrder {
	const parsedLeft: ParsedAppVersion = parseAppVersion(left);
	const parsedRight: ParsedAppVersion = parseAppVersion(right);
	for (let index = 0; index < parsedLeft.core.length; index += 1) {
		const order: AppVersionOrder = compareNumericIdentifiers(parsedLeft.core.at(index) ?? "", parsedRight.core.at(index) ?? "");
		if (order !== SAME) return order;
	}
	return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}
