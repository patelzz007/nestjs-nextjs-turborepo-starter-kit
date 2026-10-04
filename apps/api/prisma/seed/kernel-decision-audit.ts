import type { AuthorizationDecision } from "@prisma/client";
import type { AuthorizationEvaluationStep } from "@workspace/shared";

import { parsePrismaNullableJson } from "../../src/common/utils/prisma-json";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { KERNEL_SEED_IDS } from "./authorization-kernel-rows";
import { ORGANIZATION_SEED_IDS } from "./organization-seed-ids";
import { REWARD_SEED_IDS } from "./rewards";

// ---------------------------------------------------------------------------
// Authorization-kernel DECISION audit rows (`authorization_audits`).
//
// `AuthorizationAuditKernelService.auditResult` records every DENY, every write and every sensitive
// read with the full request context: the tenant and store the caller was verified for, the ACL /
// policy ids that decided, the explain() trace, the client IP + user agent, the request correlation
// id and how long the evaluation took. Two rows of the Bukit Beruang cashier, built from the seeded
// kernel rules (`buildKernelSeedRows`) so they describe decisions those rules really make:
//
//   DENY   UPDATE PRODUCT  — the location-bound ACL that forbids editing an archived product
//   ALLOW  UPDATE PAYMENT  — the location policy (v2 payment cap) that permits a refund under the cap
//
// Idempotent: deterministic ids, upserted with an empty update — append-only like the app.
// ---------------------------------------------------------------------------

const NAMESPACE = "seed.authorization_audits.kernel-decisions";
/** Fixed demo clock (2026-09-20T03:30:00Z) — rows are byte-identical across runs. */
const BASE_EPOCH_MS = 1_789_875_000_000;
const ONE_MINUTE_MS = 60_000;
/** RFC 5737 documentation address of the Bukit Beruang till. */
const CLIENT_IP = "192.0.2.58";
const CLIENT_USER_AGENT = "RewardHub-POS/2.4.1 (Android 14; Sunmi V2 Pro)";
/** Evaluation time of each decision, as the kernel measures it. */
const DENY_DURATION_MS = 3;
const ALLOW_DURATION_MS = 5;

const id = (key: string): string => deterministicUuid(NAMESPACE, key);
const requestId = (key: string): string => `seed-${id(`request:${key}`)}`;

interface KernelDecisionRow {
	readonly key: string;
	readonly minutes: number;
	readonly action: string;
	readonly resource: string;
	readonly resourceId: string | undefined;
	readonly decision: AuthorizationDecision;
	readonly trace: readonly AuthorizationEvaluationStep[];
	readonly aclIds: readonly string[];
	readonly policyIds: readonly string[];
	readonly durationMs: number;
}

export async function seedKernelDecisionAudits(): Promise<number> {
	const denyTrace: readonly AuthorizationEvaluationStep[] = [
		{ source: "tenant", effect: "NO_MATCH", reason: "Caller verified for the organization and store" },
		{
			source: "acl",
			effect: "DENY",
			reason: "Explicit ACL DENY: The Bukit Beruang cashier may not edit this product (or its images) once it is archived",
			details: { aclId: KERNEL_SEED_IDS.productScopedAcl },
		},
	];
	const allowTrace: readonly AuthorizationEvaluationStep[] = [
		{ source: "tenant", effect: "NO_MATCH", reason: "Caller verified for the organization and store" },
		{ source: "acl", effect: "NO_MATCH", reason: "No explicit ACL entry" },
		{ source: "policy", effect: "ALLOW", reason: "Payment is within the Bukit Beruang cap", details: { policyId: KERNEL_SEED_IDS.policyV2Published } },
	];
	const rows: readonly KernelDecisionRow[] = [
		{
			key: "deny-archived-product-update",
			minutes: 0,
			action: "UPDATE",
			resource: "PRODUCT",
			resourceId: KERNEL_SEED_IDS.productTarget,
			decision: "DENY",
			trace: denyTrace,
			aclIds: [KERNEL_SEED_IDS.productScopedAcl],
			policyIds: [],
			durationMs: DENY_DURATION_MS,
		},
		{
			key: "allow-payment-update-under-cap",
			minutes: 17,
			action: "UPDATE",
			resource: "PAYMENT",
			resourceId: undefined,
			decision: "ALLOW",
			trace: allowTrace,
			aclIds: [],
			policyIds: [KERNEL_SEED_IDS.policyV2Published],
			durationMs: ALLOW_DURATION_MS,
		},
	];
	for (const row of rows) {
		const rowId = id(row.key);
		await prisma.authorizationAudit.upsert({
			where: { id: rowId },
			create: {
				id: rowId,
				actorId: REWARD_SEED_IDS.mlkCashierUser,
				organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
				locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
				action: row.action,
				resource: row.resource,
				resourceId: row.resourceId ?? null,
				decision: row.decision,
				reason: row.trace.at(-1)?.reason ?? null,
				policyIds: [...row.policyIds],
				aclIds: [...row.aclIds],
				evaluation: parsePrismaNullableJson([...row.trace]),
				ipAddress: CLIENT_IP,
				userAgent: CLIENT_USER_AGENT,
				requestId: requestId(row.key),
				durationMs: row.durationMs,
				createdAt: BASE_EPOCH_MS + row.minutes * ONE_MINUTE_MS,
			},
			update: {},
		});
	}
	return rows.length;
}
