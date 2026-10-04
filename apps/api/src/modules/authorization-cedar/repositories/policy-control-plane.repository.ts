import { Injectable } from "@nestjs/common";
import type { AuthorizationPolicyDraft, AuthorizationPolicyScope, AuthorizationPolicySimulation, OrganizationMembershipRole, Prisma } from "@prisma/client";
import type { EpochMs } from "@workspace/shared";

import { mapMembershipLocationScope } from "../../organization/utils/organization-membership-mapper.util";
import type { PolicyBundleSource } from "../services/policy-bundle";

/** The transaction delegates the policy control plane reads and writes through (always the caller's transaction). */
export type PolicyControlPlaneDbClient = Pick<
	Prisma.TransactionClient,
	"authorizationPolicyDraft" | "authorizationPolicyVersion" | "authorizationPolicySimulation" | "organizationMembership" | "authorizationAudit" | "$executeRaw"
>;

/** One (organization, scope) policy slot: at most one active version, versions numbered per slot. */
export interface PolicySlot {
	/** `null` for the platform scopes (`PLATFORM_GUARDRAIL`, `PLATFORM`). */
	readonly organizationId: string | null;
	readonly scope: AuthorizationPolicyScope;
}

export interface CreatePolicyDraftRecord extends PolicySlot {
	readonly name: string;
	readonly description: string | null;
	readonly builderPayload: Prisma.InputJsonValue;
	readonly cedarSource: string;
	readonly sqlPredicate: string | null;
	readonly createdById: string;
}

/** A published policy version that contributes to runtime bundles. */
export interface ActivePolicyVersion extends PolicyBundleSource {
	readonly id: string;
}

/** An active membership — a principal the runtime evaluates, with the same location scope the runtime reads. */
export interface SimulationPrincipal {
	readonly id: string;
	readonly organizationId: string;
	readonly userId: string;
	readonly role: OrganizationMembershipRole;
	readonly locationScope: string;
	readonly locationIds: readonly string[];
}

export interface CreatePolicySimulationRecord {
	readonly id: string;
	readonly draftId: string;
	readonly actorUserId: string;
	readonly result: Prisma.InputJsonObject;
	readonly passed: boolean;
	readonly baselineFingerprint: string;
}

export interface CreatePolicyVersionRecord extends PolicySlot {
	readonly draftId: string;
	readonly version: number;
	readonly cedarSource: string;
	readonly sqlPredicate: string | null;
	readonly contentHash: string;
	readonly publishedAt: EpochMs;
	readonly publishedById: string;
}

/** One row of the authorization audit trail (`authorization_audits`, bypass-only) for a control-plane change. */
export interface PolicyAuditRecord {
	readonly draftId: string;
	readonly organizationId: string | null;
	readonly action: string;
	readonly resourceType: string;
	readonly actorUserId: string;
	/** Ids of the policy versions the change produced (empty until publish). */
	readonly policyVersionIds: readonly string[];
	readonly details: Prisma.InputJsonObject;
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
	readonly correlationId: string | null;
}

const ACTIVE_VERSION_SELECT = { id: true, organizationId: true, scope: true, version: true, cedarSource: true } satisfies Prisma.AuthorizationPolicyVersionSelect;

/** Prisma access of the policy control plane. Every method runs on the transaction it is given. */
@Injectable()
export class PolicyControlPlaneRepository {
	public async createDraft(record: CreatePolicyDraftRecord, db: PolicyControlPlaneDbClient): Promise<AuthorizationPolicyDraft> {
		return db.authorizationPolicyDraft.create({
			data: {
				organizationId: record.organizationId,
				scope: record.scope,
				name: record.name,
				description: record.description,
				builderPayload: record.builderPayload,
				cedarSource: record.cedarSource,
				sqlPredicate: record.sqlPredicate,
				status: "DRAFT",
				createdById: record.createdById,
			},
		});
	}

	public async findDraft(draftId: string, db: PolicyControlPlaneDbClient): Promise<AuthorizationPolicyDraft | null> {
		return db.authorizationPolicyDraft.findUnique({ where: { id: draftId } });
	}

	/**
	 * Transaction-scoped advisory locks serializing publishes. Every publish
	 * takes the global key (shared for a tenant slot, exclusive for a platform
	 * slot — a platform publish changes every organization's bundle) and then
	 * its slot key. The fixed order rules out lock-order deadlocks.
	 */
	public async lockForPublish(globalKey: string, slotKey: string, exclusiveGlobal: boolean, db: PolicyControlPlaneDbClient): Promise<void> {
		if (exclusiveGlobal) {
			await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${globalKey}, 0))`;
		} else {
			await db.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${globalKey}, 0))`;
		}
		await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${slotKey}, 0))`;
	}

	/**
	 * Claims a DRAFT for publication by a SECOND person: succeeds (1) only when
	 * the draft is still a draft and the approver is not its author. A
	 * concurrent publish of the same draft, or a self-approval, matches 0 rows.
	 */
	public async claimDraftForPublish(draftId: string, approverUserId: string, now: EpochMs, db: PolicyControlPlaneDbClient): Promise<number> {
		const claimed = await db.authorizationPolicyDraft.updateMany({
			where: { id: draftId, status: "DRAFT", createdById: { not: approverUserId } },
			data: { status: "PUBLISHED", approvedById: approverUserId, approvalKind: "FOUR_EYES", updatedAt: now },
		});
		return claimed.count;
	}

	public async findLatestSimulation(draftId: string, db: PolicyControlPlaneDbClient): Promise<AuthorizationPolicySimulation | null> {
		return db.authorizationPolicySimulation.findFirst({ where: { draftId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
	}

	/**
	 * Active versions in the bundles of `organizationIds` (their own versions
	 * plus the platform guardrails) — the runtime's bundle query, batched.
	 */
	public async findActiveVersionsForOrganizations(organizationIds: readonly string[], db: PolicyControlPlaneDbClient): Promise<ActivePolicyVersion[]> {
		return db.authorizationPolicyVersion.findMany({
			where: {
				supersededAt: null,
				OR: [{ organizationId: { in: [...organizationIds] } }, { organizationId: null, scope: "PLATFORM_GUARDRAIL" }],
			},
			orderBy: [{ version: "desc" }, { id: "asc" }],
			select: ACTIVE_VERSION_SELECT,
		});
	}

	/** Ids of the active versions a simulation's decisions depend on (one organization's bundle, or every bundle). */
	public async findBaselineVersionIds(organizationId: string | null, db: PolicyControlPlaneDbClient): Promise<string[]> {
		const rows = await db.authorizationPolicyVersion.findMany({
			where: organizationId === null ? { supersededAt: null } : { supersededAt: null, OR: [{ organizationId }, { organizationId: null, scope: "PLATFORM_GUARDRAIL" }] },
			orderBy: { id: "asc" },
			select: { id: true },
		});
		return rows.map((row: { id: string }): string => row.id);
	}

	/** Number of active memberships in one organization or (for `null`) in every organization. */
	public async countActivePrincipals(organizationId: string | null, db: PolicyControlPlaneDbClient): Promise<number> {
		return db.organizationMembership.count({ where: { status: "ACTIVE", isDeleted: false, ...(organizationId === null ? {} : { organizationId }) } });
	}

	/** One keyset page of active memberships, in one organization or (for `null`) in every organization. */
	public async listActivePrincipals(
		organizationId: string | null,
		afterMembershipId: string | null,
		take: number,
		db: PolicyControlPlaneDbClient,
	): Promise<SimulationPrincipal[]> {
		const rows = await db.organizationMembership.findMany({
			where: {
				status: "ACTIVE",
				isDeleted: false,
				...(organizationId === null ? {} : { organizationId }),
				...(afterMembershipId === null ? {} : { id: { gt: afterMembershipId } }),
			},
			orderBy: { id: "asc" },
			take,
			include: { locationScopes: true },
		});
		return rows.map((row): SimulationPrincipal => {
			const scope = mapMembershipLocationScope(row);
			return { id: row.id, organizationId: row.organizationId, userId: row.userId, role: row.role, locationScope: scope.locationScopeType, locationIds: scope.locationIds };
		});
	}

	public async createSimulation(record: CreatePolicySimulationRecord, db: PolicyControlPlaneDbClient): Promise<void> {
		await db.authorizationPolicySimulation.create({
			data: {
				id: record.id,
				draftId: record.draftId,
				actorUserId: record.actorUserId,
				result: record.result,
				passed: record.passed,
				baselineFingerprint: record.baselineFingerprint,
			},
		});
	}

	/** Highest version number ever published in the slot (0 when none). Call only under the slot lock. */
	public async findMaxVersion(slot: PolicySlot, db: PolicyControlPlaneDbClient): Promise<number> {
		const aggregate = await db.authorizationPolicyVersion.aggregate({
			where: { organizationId: slot.organizationId, scope: slot.scope },
			_max: { version: true },
		});
		return aggregate._max.version ?? 0;
	}

	public async supersedeActiveVersion(slot: PolicySlot, now: EpochMs, db: PolicyControlPlaneDbClient): Promise<void> {
		await db.authorizationPolicyVersion.updateMany({
			where: { organizationId: slot.organizationId, scope: slot.scope, supersededAt: null },
			data: { supersededAt: now },
		});
	}

	public async createVersion(record: CreatePolicyVersionRecord, db: PolicyControlPlaneDbClient): Promise<{ readonly id: string; readonly version: number }> {
		const created = await db.authorizationPolicyVersion.create({
			data: {
				organizationId: record.organizationId,
				draftId: record.draftId,
				scope: record.scope,
				version: record.version,
				cedarSource: record.cedarSource,
				sqlPredicate: record.sqlPredicate,
				contentHash: record.contentHash,
				publishedAt: record.publishedAt,
				publishedById: record.publishedById,
			},
			select: { id: true, version: true },
		});
		return created;
	}

	/** Appends the audit row in the caller's transaction: it commits or rolls back with the change. */
	public async appendAudit(record: PolicyAuditRecord, db: PolicyControlPlaneDbClient): Promise<void> {
		await db.authorizationAudit.create({
			data: {
				actorId: record.actorUserId,
				organizationId: record.organizationId,
				action: record.action,
				resource: record.resourceType,
				resourceId: record.draftId,
				decision: "ALLOW",
				policyIds: [...record.policyVersionIds],
				evaluation: record.details,
				ipAddress: record.ipAddress,
				userAgent: record.userAgent,
				requestId: record.correlationId,
			},
		});
	}
}
