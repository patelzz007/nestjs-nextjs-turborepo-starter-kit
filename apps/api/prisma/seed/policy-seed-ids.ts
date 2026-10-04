import type { DefaultTenantPolicyRecordIds } from "../../src/modules/organization/utils/rewardhub-policy-seed.util";

import { deterministicUuid } from "./deterministic-uuid";

/** Namespace of every deterministic policy-seed id (drafts, versions, simulations, audit rows). */
const POLICY_SEED_NAMESPACE = "seed.authorization_policy";

/** Ids of the seeded platform guardrail and its three `authorization_audits` rows. */
export interface PlatformGuardrailSeedIds {
	readonly draftId: string;
	readonly versionId: string;
	readonly simulationId: string;
	readonly auditIds: {
		readonly created: string;
		readonly simulated: string;
		readonly published: string;
	};
}

const guardrailId = (part: string): string => deterministicUuid(POLICY_SEED_NAMESPACE, `platform-guardrail:${part}`);

/**
 * Stable ids for the platform guardrail seed: every write is an upsert on
 * these ids, so re-running the seed on an already-seeded database writes no
 * new rows (no duplicated audit history).
 */
export function platformGuardrailSeedIds(): PlatformGuardrailSeedIds {
	return {
		draftId: guardrailId("draft"),
		versionId: guardrailId("version"),
		simulationId: guardrailId("simulation"),
		auditIds: { created: guardrailId("audit:created"), simulated: guardrailId("audit:simulated"), published: guardrailId("audit:published") },
	};
}

/** Stable ids for an organization's seeded default tenant policy (draft, version, audit row). */
export function defaultTenantPolicySeedIds(organizationId: string): DefaultTenantPolicyRecordIds {
	const id = (part: string): string => deterministicUuid(POLICY_SEED_NAMESPACE, `tenant-default:${organizationId}:${part}`);
	return { draftId: id("draft"), versionId: id("version"), auditId: id("audit:published") };
}
