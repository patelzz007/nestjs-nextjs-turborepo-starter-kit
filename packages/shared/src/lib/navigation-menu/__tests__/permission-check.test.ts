import { describe, expect, it } from "vitest";

import { PERMISSION } from "../../../authorization/permission";
import { createAuthorizationChecker, isKnownPermissionSlug, meetsRequirement } from "../permission-check";

const READ = PERMISSION.GITHUB_PULL_REQUEST.READ;
const UPDATE = PERMISSION.GITHUB_PULL_REQUEST.UPDATE;
const SERVERS = PERMISSION.SERVER_METRIC.LIST;

describe("createAuthorizationChecker", () => {
	const checker = createAuthorizationChecker([READ, SERVERS]);

	it("grants exactly the capabilities held: one verb never implies another", () => {
		expect(checker.can(READ)).toBe(true);
		expect(checker.can(UPDATE)).toBe(false);
		expect(checker.cannot(UPDATE)).toBe(true);
	});

	it("checks several with AND (canAll) and OR (canAny)", () => {
		expect(checker.canAll([READ, SERVERS])).toBe(true);
		expect(checker.canAll([READ, UPDATE])).toBe(false);
		expect(checker.canAny([UPDATE, SERVERS])).toBe(true);
		expect(checker.canAny([UPDATE])).toBe(false);
	});

	it("denies everything when the session holds nothing (fail closed)", () => {
		expect(createAuthorizationChecker([]).can(READ)).toBe(false);
	});
});

describe("meetsRequirement", () => {
	const checker = createAuthorizationChecker([READ]);

	it("checks one capability, or several under their mode (any by default)", () => {
		expect(meetsRequirement(checker, { permission: READ })).toBe(true);
		expect(meetsRequirement(checker, { permissions: [READ, UPDATE] })).toBe(true);
		expect(meetsRequirement(checker, { permissions: [READ, UPDATE], mode: "all" })).toBe(false);
	});

	it("is never met by a requirement that names no capability", () => {
		expect(meetsRequirement(checker, {})).toBe(false);
	});
});

describe("isKnownPermissionSlug", () => {
	it("accepts a platform slug only when it names a known action and resource", () => {
		expect(isKnownPermissionSlug(READ)).toBe(true);
		expect(isKnownPermissionSlug("platform:product.lsit")).toBe(false);
	});
});
