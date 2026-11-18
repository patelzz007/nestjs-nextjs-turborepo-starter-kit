import { describe, expect, it } from "vitest";

import { PERMISSION } from "../../../authorization/permission";
import { createGrantedCapabilities, isCapabilityGranted, isKnownPermissionSlug } from "../permission-check";

const READ = PERMISSION.GITHUB_PULL_REQUEST.READ;
const UPDATE = PERMISSION.GITHUB_PULL_REQUEST.UPDATE;
const SERVERS = PERMISSION.SERVER_METRIC.LIST;

describe("isCapabilityGranted", () => {
	const granted = createGrantedCapabilities([READ, SERVERS]);

	it("grants exactly the capabilities held: one verb never implies another", () => {
		expect(isCapabilityGranted(granted, READ)).toBe(true);
		expect(isCapabilityGranted(granted, SERVERS)).toBe(true);
		expect(isCapabilityGranted(granted, UPDATE)).toBe(false);
	});

	it("denies everything when the session holds nothing (fail closed)", () => {
		expect(isCapabilityGranted(createGrantedCapabilities([]), READ)).toBe(false);
	});
});

describe("isKnownPermissionSlug", () => {
	it("accepts a platform slug only when it names a known action and resource", () => {
		expect(isKnownPermissionSlug(READ)).toBe(true);
		expect(isKnownPermissionSlug("platform:product.lsit")).toBe(false);
	});
});
