import { ForbiddenException } from "@nestjs/common";
import type { OrganizationLifecycleState } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { assertOrganizationOperating, isOrganizationOperating } from "./organization-operating-status.policy";

const NOT_OPERATING: OrganizationLifecycleState[] = ["PROVISIONING", "RESTRICTED", "SUSPENDED", "PENDING_DELETION", "DELETED"];

describe("organization operating status policy", () => {
	it("lets only an ACTIVE, non-deleted organization operate", () => {
		expect(isOrganizationOperating({ lifecycleState: "ACTIVE", isDeleted: false })).toBe(true);
		expect(isOrganizationOperating({ lifecycleState: "ACTIVE", isDeleted: true })).toBe(false);
	});

	it.each(NOT_OPERATING)("refuses a %s organization with 403 ORGANIZATION_NOT_ACTIVE", (lifecycleState) => {
		let thrown: ForbiddenException | null = null;
		try {
			assertOrganizationOperating({ lifecycleState, isDeleted: false });
		} catch (error) {
			thrown = error instanceof ForbiddenException ? error : null;
		}
		expect(thrown?.getResponse()).toMatchObject({ error: "ORGANIZATION_NOT_ACTIVE" });
	});
});
