import { describe, expect, it } from "vitest";

import { TenantJobContextService } from "./tenant-job-context.service";

describe("TenantJobContextService", () => {
	it("signs and verifies tenant job context", () => {
		const service = new TenantJobContextService();
		const now = Date.now();
		const signed = service.sign({
			organizationId: "00000000-0000-4000-8000-000000000001",
			initiatingActorId: null,
			purpose: "rewards.auto_publish",
			policyVersion: 1,
			correlationId: "test",
			issuedAt: now,
			expiresAt: now + 60_000,
		});
		expect(service.verify(signed)).toBe(true);
	});

	it("rejects expired context", () => {
		const service = new TenantJobContextService();
		const past = Date.now() - 10_000;
		const signed = service.sign({
			organizationId: "00000000-0000-4000-8000-000000000001",
			initiatingActorId: null,
			purpose: "test",
			policyVersion: 1,
			correlationId: "test",
			issuedAt: past - 60_000,
			expiresAt: past,
		});
		expect(service.verify(signed)).toBe(false);
	});
});
