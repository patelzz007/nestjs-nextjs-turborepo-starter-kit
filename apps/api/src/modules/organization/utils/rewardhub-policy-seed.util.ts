import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { sha256Hex } from "../../../common/crypto/sha256";

type PolicySeedClient = Pick<PrismaClient, "authorizationPolicyDraft" | "authorizationPolicyVersion" | "authorizationAudit">;

const REWARDHUB_OWNER_CEDAR = `permit(principal, action, resource) when { principal.role == "OWNER" || principal.role == "ADMIN" };`;
const REWARDHUB_CASHIER_CEDAR = `permit(principal, action, resource) when { principal.role == "CASHIER" };`;

/**
 * Default TENANT Cedar policy published for every organization. It is role-
 * based and action-agnostic, so it never denies what the merchant role table
 * (`MERCHANT_ROLE_CAPABILITIES`) grants to OWNER / ADMIN / CASHIER; tenants
 * narrow it through the policy control plane.
 */
export const REWARDHUB_DEFAULT_TENANT_CEDAR = `${REWARDHUB_OWNER_CEDAR}\n${REWARDHUB_CASHIER_CEDAR}`;

/** Builder payload the default template corresponds to (`PolicyTemplateCompiler` "tenant.role_capability"). */
const REWARDHUB_DEFAULT_TEMPLATE_PAYLOAD = { templateId: "tenant.role_capability", parameters: { allowedRoles: ["OWNER", "ADMIN", "CASHIER"] } };

/** Authorization audit action of a default-template publish. */
export const DEFAULT_TENANT_POLICY_AUDIT_ACTION = "policy.default_template.published";

/** Ids of the rows a default-template publish writes. */
export interface DefaultTenantPolicyRecordIds {
	readonly draftId: string;
	readonly versionId: string;
	readonly auditId: string;
}

/** Fresh ids for a runtime publish (provisioning); the seed passes deterministic ones. */
export function newDefaultTenantPolicyRecordIds(): DefaultTenantPolicyRecordIds {
	return { draftId: randomUUID(), versionId: randomUUID(), auditId: randomUUID() };
}

/** Version number of the first published TENANT policy of an organization. */
const INITIAL_TENANT_POLICY_VERSION = 1;

/**
 * Idempotently publish the default RewardHub TENANT Cedar policy for an
 * organization, inside the caller's transaction.
 *
 * This is NOT a four-eyes control-plane publish and does not pretend to be
 * one: the source is a fixed, code-reviewed template (reviewed through code
 * review, not by a runtime approver), so the draft records approval kind
 * `PLATFORM_DEFAULT_TEMPLATE` with NO approver — never the provisioning actor
 * approving their own draft — and the publish is written to the
 * authorization audit trail with that reason. Any later change to the tenant
 * policy goes through the four-eyes control plane. Returns the
 * organization's active TENANT policy version.
 *
 * Rows are written with `ids`: random at runtime, deterministic in the seed.
 * The audit row is an upsert on its id, so a re-run never duplicates it.
 */
export async function seedRewardHubTenantPolicies(
	tx: PolicySeedClient,
	organizationId: string,
	actorUserId: string,
	ids: DefaultTenantPolicyRecordIds = newDefaultTenantPolicyRecordIds(),
): Promise<number> {
	const existing = await tx.authorizationPolicyVersion.findFirst({
		where: { organizationId, scope: "TENANT", supersededAt: null },
	});

	if (existing !== null) {
		return existing.version;
	}

	const cedarSource = REWARDHUB_DEFAULT_TENANT_CEDAR;
	const draft = await tx.authorizationPolicyDraft.create({
		data: {
			id: ids.draftId,
			organizationId,
			scope: "TENANT",
			name: "RewardHub role access",
			description: "Default RewardHub Cedar permits for organization members",
			builderPayload: REWARDHUB_DEFAULT_TEMPLATE_PAYLOAD,
			cedarSource,
			status: "PUBLISHED",
			createdById: actorUserId,
			approvedById: null,
			approvalKind: "PLATFORM_DEFAULT_TEMPLATE",
		},
	});

	const version = await tx.authorizationPolicyVersion.create({
		data: {
			id: ids.versionId,
			organizationId,
			draftId: draft.id,
			scope: "TENANT",
			version: INITIAL_TENANT_POLICY_VERSION,
			cedarSource,
			contentHash: sha256Hex(cedarSource),
			publishedAt: BigInt(Date.now()),
			publishedById: actorUserId,
		},
	});

	await tx.authorizationAudit.upsert({
		where: { id: ids.auditId },
		update: {},
		create: {
			id: ids.auditId,
			actorId: actorUserId,
			organizationId,
			action: DEFAULT_TENANT_POLICY_AUDIT_ACTION,
			resource: "AuthorizationPolicyDraft",
			resourceId: draft.id,
			decision: "ALLOW",
			reason: "Platform default tenant policy template published at organization provisioning (approval kind PLATFORM_DEFAULT_TEMPLATE; no runtime approver)",
			policyIds: [version.id],
			evaluation: { templateId: REWARDHUB_DEFAULT_TEMPLATE_PAYLOAD.templateId, version: INITIAL_TENANT_POLICY_VERSION, contentHash: sha256Hex(cedarSource) },
		},
	});
	return INITIAL_TENANT_POLICY_VERSION;
}

/**
 * The organization's effective policy version, read inside the caller's
 * transaction: the highest live version among its own policies and the
 * platform guardrails — the same version `CedarPolicyEvaluatorService` stamps
 * on decisions. Used where the organization (and its policies) are not yet
 * committed, so the evaluator's own (separate-connection, cached) load would
 * not see them.
 */
export async function findActivePolicyVersionInTx(tx: Pick<PrismaClient, "authorizationPolicyVersion">, organizationId: string): Promise<number> {
	const latest = await tx.authorizationPolicyVersion.aggregate({
		where: { OR: [{ organizationId }, { organizationId: null, scope: "PLATFORM_GUARDRAIL" }], supersededAt: null },
		_max: { version: true },
	});
	return Math.max(INITIAL_TENANT_POLICY_VERSION, latest._max.version ?? INITIAL_TENANT_POLICY_VERSION);
}
