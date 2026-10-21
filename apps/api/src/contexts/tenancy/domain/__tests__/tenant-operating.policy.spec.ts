import type { TenantLifecycleState } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { isTenantOperating } from "../policies/tenant-operating.policy";

/** Every lifecycle state but ACTIVE. */
const NOT_OPERATING: readonly TenantLifecycleState[] = ["PROVISIONING", "RESTRICTED", "SUSPENDED", "BANNED", "PENDING_DELETION", "DELETED"];

describe("isTenantOperating", () => {
	it("lets only an ACTIVE, live tenant operate", () => {
		expect(isTenantOperating({ lifecycleState: "ACTIVE", isDeleted: false })).toBe(true);
		expect(isTenantOperating({ lifecycleState: "ACTIVE", isDeleted: true })).toBe(false);
	});

	it.each(NOT_OPERATING)("refuses a %s tenant", (lifecycleState) => {
		expect(isTenantOperating({ lifecycleState, isDeleted: false })).toBe(false);
	});
});
