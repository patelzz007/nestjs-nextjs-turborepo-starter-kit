import { describe, expect, it } from "vitest";

import { defaultTenantPolicySeedIds, platformGuardrailSeedIds } from "./policy-seed-ids";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ORG_A = "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c";
const ORG_B = "b57401d5-536e-464f-9ae9-4756b6dd5f61";

function tenantIds(organizationId: string): string[] {
	const ids = defaultTenantPolicySeedIds(organizationId);
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

	it("are valid v4-shaped UUIDs and never collide across rows or organizations", () => {
		const ids = allIds();
		expect(ids.every((id) => UUID_PATTERN.test(id))).toBe(true);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
