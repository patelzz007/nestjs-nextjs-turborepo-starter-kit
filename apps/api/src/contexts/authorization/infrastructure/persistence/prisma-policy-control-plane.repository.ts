import type { AuthorizationPolicyDraft, Prisma } from "@prisma/client";
import { epochMs, JsonValueSchema, type EpochMs } from "@workspace/shared";

import type { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import { parsePrismaInputJson, parsePrismaRequiredJson } from "../../../../platform/infrastructure/utils/prisma-json";
import {
	POLICY_DRAFT_AUDIT_RESOURCE,
	type ActivePolicyVersion,
	type NewPolicySimulation,
	type NewPolicyVersion,
	type PolicyAuditRecord,
	type PolicyAuditWriter,
	type PolicyPrincipalReader,
	type PolicySimulationStore,
	type PolicyVersionStore,
	type SimulationPrincipal,
} from "../../application/ports/policy-control-plane.port";
import {
	AuthorizationPolicyDraftAggregate,
	type PolicyDraftState,
	type PolicySimulationSnapshot,
	type PolicySlot,
} from "../../domain/aggregates/authorization-policy-draft.aggregate";
import { CorruptAuthorizationStateError, PolicyDraftNotPublishableError } from "../../domain/errors/authorization.errors";
import type { PolicyDraftRepository } from "../../domain/repositories/policy-draft.repository";
// Memberships belong to tenants: their location scope is read through its public mapper.
import { mapMembershipLocationScope } from "../../../tenancy/public-api";

/** Advisory-lock namespace shared by every policy publish (taken shared by tenant slots, exclusive by platform slots). */
export const POLICY_PUBLISH_GLOBAL_LOCK_KEY = "authorization_policy_publish:all";

/** Advisory-lock key of one (tenant, scope) policy slot. */
export function policySlotLockKey(tenantId: string | null, scope: string): string {
	return `authorization_policy_publish:${scope}:${tenantId ?? "platform"}`;
}

const ACTIVE_VERSION_SELECT = { id: true, tenantId: true, scope: true, version: true, cedarSource: true } satisfies Prisma.AuthorizationPolicyVersionSelect;

function draftStateOf(row: AuthorizationPolicyDraft): PolicyDraftState {
	const builderPayload = JsonValueSchema.safeParse(row.builderPayload);
	if (!builderPayload.success) {
		throw new CorruptAuthorizationStateError("AuthorizationPolicyDraft", row.id);
	}
	return {
		id: row.id,
		tenantId: row.tenantId,
		scope: row.scope,
		name: row.name,
		description: row.description,
		builderPayload: builderPayload.data,
		cedarSource: row.cedarSource,
		sqlPredicate: row.sqlPredicate,
		status: row.status,
		createdById: row.createdById,
		approvedById: row.approvedById,
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

/** `AuthorizationPolicyDraft` on the control-plane transaction. */
export class PrismaPolicyDraftRepository implements PolicyDraftRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findById(draftId: string): Promise<AuthorizationPolicyDraftAggregate | null> {
		const row: AuthorizationPolicyDraft | null = await this.db.authorizationPolicyDraft.findUnique({ where: { id: draftId } });
		return row === null ? null : AuthorizationPolicyDraftAggregate.rehydrate(draftStateOf(row));
	}

	public async add(draft: AuthorizationPolicyDraftAggregate): Promise<void> {
		const state: PolicyDraftState = draft.snapshot();
		await this.db.authorizationPolicyDraft.create({
			data: {
				id: state.id,
				tenantId: state.tenantId,
				scope: state.scope,
				name: state.name,
				description: state.description,
				builderPayload: parsePrismaRequiredJson(state.builderPayload),
				cedarSource: state.cedarSource,
				sqlPredicate: state.sqlPredicate,
				status: "DRAFT",
				createdById: state.createdById,
			},
		});
	}

	/** Succeeds only while the draft is still in the loaded status and the approver is not its author. */
	public async savePublished(draft: AuthorizationPolicyDraftAggregate): Promise<void> {
		const state: PolicyDraftState = draft.snapshot();
		if (state.approvedById === null) {
			throw new PolicyDraftNotPublishableError("claimed");
		}
		const claimed = await this.db.authorizationPolicyDraft.updateMany({
			where: { id: state.id, status: draft.concurrencyToken, createdById: { not: state.approvedById } },
			data: { status: state.status, approvedById: state.approvedById, approvalKind: "FOUR_EYES", updatedAt: state.updatedAt },
		});
		if (claimed.count !== 1) {
			throw new PolicyDraftNotPublishableError("claimed");
		}
	}
}

/** Published versions, simulations, principals and the control-plane audit trail, on the control-plane transaction. */
export class PrismaPolicyControlPlaneStore implements PolicyVersionStore, PolicySimulationStore, PolicyPrincipalReader, PolicyAuditWriter {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly requestContext: RequestContextService,
	) {}

	public async lockSlotForPublish(slot: PolicySlot): Promise<void> {
		if (slot.tenantId === null) {
			await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${POLICY_PUBLISH_GLOBAL_LOCK_KEY}, 0))`;
		} else {
			await this.db.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${POLICY_PUBLISH_GLOBAL_LOCK_KEY}, 0))`;
		}
		await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${policySlotLockKey(slot.tenantId, slot.scope)}, 0))`;
	}

	public async maxVersion(slot: PolicySlot): Promise<number> {
		const aggregate = await this.db.authorizationPolicyVersion.aggregate({ where: { tenantId: slot.tenantId, scope: slot.scope }, _max: { version: true } });
		return aggregate._max.version ?? 0;
	}

	public async supersedeActive(slot: PolicySlot, now: EpochMs): Promise<void> {
		await this.db.authorizationPolicyVersion.updateMany({
			where: { tenantId: slot.tenantId, scope: slot.scope, supersededAt: null },
			data: { supersededAt: now },
		});
	}

	public async create(version: NewPolicyVersion): Promise<{ readonly id: string; readonly version: number }> {
		return this.db.authorizationPolicyVersion.create({
			data: {
				tenantId: version.tenantId,
				draftId: version.draftId,
				scope: version.scope,
				version: version.version,
				cedarSource: version.cedarSource,
				sqlPredicate: version.sqlPredicate,
				contentHash: version.contentHash,
				publishedAt: version.publishedAt,
				publishedById: version.publishedById,
			},
			select: { id: true, version: true },
		});
	}

	public async baselineVersionIds(tenantId: string | null): Promise<string[]> {
		const rows = await this.db.authorizationPolicyVersion.findMany({
			where: tenantId === null ? { supersededAt: null } : { supersededAt: null, OR: [{ tenantId }, { tenantId: null, scope: "PLATFORM_GUARDRAIL" }] },
			orderBy: { id: "asc" },
			select: { id: true },
		});
		return rows.map((row: { id: string }): string => row.id);
	}

	public async activeVersionsForTenants(tenantIds: readonly string[]): Promise<ActivePolicyVersion[]> {
		return this.db.authorizationPolicyVersion.findMany({
			where: { supersededAt: null, OR: [{ tenantId: { in: [...tenantIds] } }, { tenantId: null, scope: "PLATFORM_GUARDRAIL" }] },
			orderBy: [{ version: "desc" }, { id: "asc" }],
			select: ACTIVE_VERSION_SELECT,
		});
	}

	public async record(simulation: NewPolicySimulation): Promise<void> {
		await this.db.authorizationPolicySimulation.create({
			data: {
				id: simulation.id,
				draftId: simulation.draftId,
				actorUserId: simulation.actorUserId,
				result: parsePrismaInputJson(simulation.result),
				passed: simulation.result.passed,
				baselineFingerprint: simulation.baselineFingerprint,
			},
		});
	}

	public async latestFor(draftId: string): Promise<PolicySimulationSnapshot | null> {
		const row = await this.db.authorizationPolicySimulation.findFirst({ where: { draftId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
		return row === null ? null : { passed: row.passed, createdAt: epochMs(Number(row.createdAt)), baselineFingerprint: row.baselineFingerprint };
	}

	public async countActive(tenantId: string | null): Promise<number> {
		return this.db.membership.count({ where: { status: "ACTIVE", isDeleted: false, ...(tenantId === null ? {} : { tenantId }) } });
	}

	public async listActive(tenantId: string | null, afterMembershipId: string | null, take: number): Promise<SimulationPrincipal[]> {
		const rows = await this.db.membership.findMany({
			where: {
				status: "ACTIVE",
				isDeleted: false,
				...(tenantId === null ? {} : { tenantId }),
				...(afterMembershipId === null ? {} : { id: { gt: afterMembershipId } }),
			},
			orderBy: { id: "asc" },
			take,
			include: { locationScopes: { where: { isDeleted: false } } },
		});
		return rows.map((row): SimulationPrincipal => {
			const scope = mapMembershipLocationScope(row);
			return { id: row.id, tenantId: row.tenantId, userId: row.userId, role: row.role, locationScope: scope.locationScopeType, locationIds: scope.locationIds };
		});
	}

	public async append(record: PolicyAuditRecord): Promise<void> {
		const request = this.requestContext.current();
		await this.db.authorizationAudit.create({
			data: {
				actorId: record.actorUserId,
				tenantId: record.tenantId,
				action: record.action,
				resource: POLICY_DRAFT_AUDIT_RESOURCE,
				resourceId: record.draftId,
				decision: "ALLOW",
				policyIds: [...record.policyVersionIds],
				evaluation: parsePrismaInputJson({ ...record.details, scope: record.scope }),
				ipAddress: request?.ip ?? null,
				userAgent: request?.userAgent ?? null,
				requestId: request?.correlationId ?? null,
			},
		});
	}
}
