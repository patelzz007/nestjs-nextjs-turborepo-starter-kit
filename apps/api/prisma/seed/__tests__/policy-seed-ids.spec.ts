import { describe, expect, it } from "vitest";

import { defaultTenantPolicySeedIds, platformGuardrailSeedIds } from "../policy-seed-ids";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ORG_A = "019b76da-a800-7a94-a198-23ad1b4cfdd9";
const ORG_B = "019b76da-a800-72b9-80b8-91bd729eddbe";

function tenantIds(tenantId: string): string[] {
	const ids = defaultTenantPolicySeedIds(tenantId);
	return [ids.draftId, ids.versionId, ids.auditId];
}

function allIds(): string[] {
	const guardrail = platformGuardrailSeedIds();
	return [
		guardrail.draftId,
		guardrail.versionId,
		guardrail.simulationId,
		guardrail.auditIds.created,
		guardrail.auditIds.simulated,
		guardrail.auditIds.published,
		...tenantIds(ORG_A),
		...tenantIds(ORG_B),
	];
}

describe("policy seed ids", () => {
	it("are identical on every run, so the seed's upserts write no new rows (no duplicated audit history) on re-run", () => {
		expect(platformGuardrailSeedIds()).toEqual(platformGuardrailSeedIds());
		expect(defaultTenantPolicySeedIds(ORG_A)).toEqual(defaultTenantPolicySeedIds(ORG_A));
	});

	it("are UUID v7s, like every row id, and never collide across rows or tenants", () => {
		const ids = allIds();
		expect(ids.every((id) => UUID_PATTERN.test(id))).toBe(true);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
