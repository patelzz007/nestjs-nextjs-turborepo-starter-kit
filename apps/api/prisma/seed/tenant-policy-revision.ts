import type { Prisma, User } from "@prisma/client";

import { sha256Hex } from "../../src/common/crypto/sha256";
import { POLICY_AUDIT_ACTIONS, POLICY_DRAFT_AUDIT_RESOURCE } from "../../src/modules/authorization-cedar/constants/policy-control-plane.constants";
import { policyBaselineFingerprint } from "../../src/modules/authorization-cedar/services/policy-baseline";
import { POLICY_TEMPLATE_IDS, PolicyTemplateCompiler } from "../../src/modules/authorization-cedar/services/policy-template.compiler";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";

// ---------------------------------------------------------------------------
// A tenant policy revision published through the policy control plane.
//
// Every organization starts on the default role policy (version 1, template
// `PLATFORM_DEFAULT_TEMPLATE`, no approver). A tenant narrows or extends it through the four-eyes
// control plane (`PolicyControlPlaneService`): draft -> simulate -> approve-and-publish by a
// DIFFERENT SuperAdmin. This seeds that revision for the Jonker Street Kitchen tenant, in the order
// and with the rows the service writes in one transaction:
//
//   draft (compiled Cedar + the SQL visibility predicate), a passing simulation against the current
//   baseline, the conditional supersede of version 1 (`superseded_at`), version 2 (carrying the
//   predicate), and the three `authorization_audits` rows with the request context (IP, user agent,
//   correlation id) of the SuperAdmin's browser session.
//
// A published version REPLACES the slot's previous one, so the revision keeps every default role permit
// (owner, admin, cashier) and adds the owner-only ownership-transfer guard. That guard concerns an
// action outside the simulated capability actions, so no capability decision changes (affected: 0).
// Idempotent: written once, keyed by its deterministic draft id.
// ---------------------------------------------------------------------------

const NAMESPACE = "seed.authorization_policy.tenant-revision";
const TENANT_POLICY_REVISION = 2;
const REVISION_NAME = "Owner-only ownership transfer";
const REVISION_DESCRIPTION = "Owners, admins and cashiers keep their role permits; only an owner may transfer ownership";
/** RFC 5737 documentation address of the SuperAdmin session that authored / approved the change. */
const AUTHOR_IP = "198.51.100.17";
const APPROVER_IP = "198.51.100.42";
const SESSION_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const MS_PER_MINUTE = 60_000;
/** Minutes between the draft, its simulation and the approval (simulations stay valid for an hour). */
const SIMULATION_AFTER_DRAFT_MINUTES = 4;
const PUBLISH_AFTER_SIMULATION_MINUTES = 12;

const id = (key: string): string => deterministicUuid(NAMESPACE, key);
const correlation = (key: string): string => `seed-${id(`correlation:${key}`)}`;

/**
 * Publishes the revision for `organizationId`: drafted by `author`, approved and published by
 * `approver` (two distinct SuperAdmins — the four-eyes rule). Returns true when it wrote the
 * revision, false when it was already there or the organization has no active version to supersede.
 */
export async function seedTenantPolicyRevision(organizationId: string, author: Pick<User, "id">, approver: Pick<User, "id">): Promise<boolean> {
	if (author.id === approver.id) {
		throw new Error("Seed policy approval needs two distinct users (four-eyes)");
	}
	const draftId = id(`draft:${organizationId}`);
	if ((await prisma.authorizationPolicyDraft.findUnique({ where: { id: draftId }, select: { id: true } })) !== null) {
		return false;
	}

	const builderPayload = { templateId: POLICY_TEMPLATE_IDS.tenantRoleCapability, parameters: { allowedRoles: ["OWNER", "ADMIN", "CASHIER"] } };
	const compiled = new PolicyTemplateCompiler().compile(builderPayload, organizationId);
	const draftedAt = Date.now();
	const simulatedAt = draftedAt + SIMULATION_AFTER_DRAFT_MINUTES * MS_PER_MINUTE;
	const publishedAt = simulatedAt + PUBLISH_AFTER_SIMULATION_MINUTES * MS_PER_MINUTE;
	const simulationId = id(`simulation:${organizationId}`);
	const versionId = id(`version:${organizationId}`);

	return prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<boolean> => {
		const baseline = await tx.authorizationPolicyVersion.findMany({
			where: { supersededAt: null, OR: [{ organizationId }, { organizationId: null, scope: "PLATFORM_GUARDRAIL" }] },
			orderBy: { id: "asc" },
			select: { id: true },
		});
		const active = await tx.authorizationPolicyVersion.findFirst({ where: { organizationId, scope: "TENANT", supersededAt: null }, select: { version: true } });
		if (active === null) {
			return false;
		}
		const evaluatedPrincipalCount = await tx.organizationMembership.count({ where: { organizationId, status: "ACTIVE", isDeleted: false } });

		await tx.authorizationPolicyDraft.create({
			data: {
				id: draftId,
				organizationId,
				scope: "TENANT",
				name: REVISION_NAME,
				description: REVISION_DESCRIPTION,
				builderPayload,
				cedarSource: compiled.cedarSource,
				sqlPredicate: compiled.sqlPredicate,
				status: "PUBLISHED",
				createdById: author.id,
				approvedById: approver.id,
				approvalKind: "FOUR_EYES",
				createdAt: draftedAt,
				updatedAt: publishedAt,
			},
		});
		await tx.authorizationPolicySimulation.create({
			data: {
				id: simulationId,
				draftId,
				actorUserId: author.id,
				passed: true,
				baselineFingerprint: policyBaselineFingerprint(baseline.map((row) => row.id)),
				result: {
					simulationId,
					passed: true,
					warnings: [],
					errors: [],
					evaluatedPrincipalCount,
					affectedPrincipalCount: 0,
					wouldLockOutOwners: false,
					decisionChanges: [],
					decisionChangesTruncated: false,
				},
				createdAt: simulatedAt,
			},
		});
		// Same order as `publish`: supersede the active version in the slot, then insert the next one.
		await tx.authorizationPolicyVersion.updateMany({ where: { organizationId, scope: "TENANT", supersededAt: null }, data: { supersededAt: publishedAt } });
		const version = await tx.authorizationPolicyVersion.create({
			data: {
				id: versionId,
				organizationId,
				draftId,
				scope: "TENANT",
				version: TENANT_POLICY_REVISION,
				cedarSource: compiled.cedarSource,
				sqlPredicate: compiled.sqlPredicate,
				contentHash: sha256Hex(compiled.cedarSource),
				publishedAt,
				publishedById: approver.id,
			},
		});

		const audit = (
			key: string,
			action: string,
			actorId: string,
			ipAddress: string,
			createdAt: number,
			policyIds: string[],
			evaluation: Record<string, string | number | boolean | null>,
		): Prisma.AuthorizationAuditUncheckedCreateInput & { readonly id: string } => ({
			id: id(`audit:${organizationId}:${key}`),
			actorId,
			organizationId,
			action,
			resource: POLICY_DRAFT_AUDIT_RESOURCE,
			resourceId: draftId,
			decision: "ALLOW",
			policyIds,
			evaluation: { ...evaluation, scope: "TENANT" },
			ipAddress,
			userAgent: SESSION_USER_AGENT,
			requestId: correlation(`${organizationId}:${key}`),
			createdAt,
		});
		const rows: readonly (Prisma.AuthorizationAuditUncheckedCreateInput & { readonly id: string })[] = [
			audit("created", POLICY_AUDIT_ACTIONS.draftCreated, author.id, AUTHOR_IP, draftedAt, [], { name: REVISION_NAME }),
			audit("simulated", POLICY_AUDIT_ACTIONS.draftSimulated, author.id, AUTHOR_IP, simulatedAt, [], {
				simulationId,
				passed: true,
				evaluatedPrincipalCount,
				affectedPrincipalCount: 0,
			}),
			audit("published", POLICY_AUDIT_ACTIONS.draftPublished, approver.id, APPROVER_IP, publishedAt, [version.id], {
				version: TENANT_POLICY_REVISION,
				authorUserId: author.id,
				approverUserId: approver.id,
				approvalNote: "Reviewed against the Bukit Beruang rollout",
			}),
		];
		for (const row of rows) {
			await tx.authorizationAudit.upsert({ where: { id: row.id }, create: row, update: {} });
		}
		return true;
	});
}
