import { KybStatusSchema, TenantLifecycleStateSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { KYB_STATUS_DISPLAY, TENANT_LIFECYCLE_DISPLAY } from "../tenant-status";

describe("TENANT_LIFECYCLE_DISPLAY", () => {
	it("labels every lifecycle state in words, never the raw enum value", () => {
		for (const state of TenantLifecycleStateSchema.options) {
			expect(TENANT_LIFECYCLE_DISPLAY[state].label).not.toBe(state);
		}
	});

	it("draws an active tenant as good news and a suspended one as blocked", () => {
		expect(TENANT_LIFECYCLE_DISPLAY.ACTIVE.tone).toBe("success");
		expect(TENANT_LIFECYCLE_DISPLAY.SUSPENDED.tone).toBe("danger");
	});
});

describe("KYB_STATUS_DISPLAY", () => {
	it("labels every verification status in words, never the raw enum value", () => {
		for (const status of KybStatusSchema.options) {
			expect(KYB_STATUS_DISPLAY[status].label).not.toBe(status);
		}
	});

	it("marks a pending review as waiting, an approval as success and a rejection as danger", () => {
		expect(KYB_STATUS_DISPLAY.PENDING).toEqual({ label: "Pending review", tone: "warning" });
		expect(KYB_STATUS_DISPLAY.APPROVED.tone).toBe("success");
		expect(KYB_STATUS_DISPLAY.REJECTED.tone).toBe("danger");
	});
});
