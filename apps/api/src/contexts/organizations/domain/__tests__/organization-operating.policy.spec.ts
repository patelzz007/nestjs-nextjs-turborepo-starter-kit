import type { OrganizationLifecycleState } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { isOrganizationOperating } from "../policies/organization-operating.policy";

/** Every lifecycle state but ACTIVE. */
const NOT_OPERATING: readonly OrganizationLifecycleState[] = ["PROVISIONING", "RESTRICTED", "SUSPENDED", "PENDING_DELETION", "DELETED"];

describe("isOrganizationOperating", () => {
	it("lets only an ACTIVE, live organization operate", () => {
		expect(isOrganizationOperating({ lifecycleState: "ACTIVE", isDeleted: false })).toBe(true);
		expect(isOrganizationOperating({ lifecycleState: "ACTIVE", isDeleted: true })).toBe(false);
	});

	it.each(NOT_OPERATING)("refuses a %s organization", (lifecycleState) => {
		expect(isOrganizationOperating({ lifecycleState, isDeleted: false })).toBe(false);
	});
});
