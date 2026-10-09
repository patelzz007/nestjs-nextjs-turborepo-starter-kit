import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { SystemOperation } from "../../../prisma/system-operation.registry";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationAuditService, type AuditActor, type AuditEntry } from "../audit/authorization-audit.service";
import { RBAC_MUTATION_ADVISORY_LOCK_KEY } from "../constants/authorization.constants";
import { AuthorizationEventEmitter } from "../events/authorization.events";
import type { AuthorizationActor } from "./privilege-escalation.service";
import { revokedBySystem, revokedByUser, type SessionRevoker } from "../../sessions/device/session-revoker";
import { UserSessionRevocationService } from "./user-session-revocation.service";

/** An audit row a mutation asks for — the runner stamps the actor. */
export type RbacAuditDraft = Omit<AuditEntry, "actor">;

/** A mutation that changed RBAC state. */
export interface RbacMutationChanged<T> {
	readonly kind: "changed";
	readonly result: T;
	/** The audit row describing the change — written in the same transaction, with the actor stamped by the runner. */
	readonly audit: RbacAuditDraft;
	/** Users whose effective authorization changed: their sessions are revoked in the same transaction. */
	readonly affectedUserIds: readonly string[];
}

/** An idempotent mutation that found nothing to change (no write, so no audit row and no revocation). */
export interface RbacMutationUnchanged<T> {
	readonly kind: "unchanged";
	readonly result: T;
}

/** What one RBAC mutation's transactional work produced. */
export type RbacMutationOutcome<T> = RbacMutationChanged<T> | RbacMutationUnchanged<T>;

/**
 * What one system-operation RBAC mutation produced: a batch job (e.g. expiry)
 * changes many rows, so it records one audit row per changed row. An empty
 * `audits` list means nothing changed.
 */
export interface RbacSystemMutationOutcome<T> {
	readonly result: T;
	readonly audits: readonly RbacAuditDraft[];
	readonly affectedUserIds: readonly string[];
}

/** Internal: the normalized product of either entry point. */
interface NormalizedOutcome<T> {
	readonly result: T;
	readonly audits: readonly RbacAuditDraft[];
	readonly affectedUserIds: readonly string[];
}

/**
 * The one way RBAC state changes.
 *
 * Each run is a single transaction under an allowlisted system operation
 * (`authorization.rbac.mutate` for user-initiated changes — role /
 * permission catalogs and other users' assignments are not writable under
 * the caller's own RLS scope, so the route permission + privilege-escalation
 * checks are the authorization; a scheduled job runs under its own operation,
 * e.g. `maintenance.permission_expiry`). Inside it:
 *
 * 1. the RBAC advisory lock, so every check the work performs (escalation
 *    subset, separation of duties, last protected holder) reads state no
 *    concurrent RBAC write can change before commit;
 * 2. the work (checks + write);
 * 3. refresh-token revocation + tokenVersion bump for every affected user;
 * 4. the audit row(s) with the explicit actor.
 *
 * Any failure — including an audit insert — rolls everything back. Only after
 * commit are caches invalidated (on every instance) and `users/me`
 * invalidation events emitted.
 */
@Injectable()
export class RbacMutationRunner {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: AuthorizationAuditService,
		private readonly sessionRevocation: UserSessionRevocationService,
		private readonly events: AuthorizationEventEmitter,
	) {}

	/** A change made by an authenticated user. */
	public async run<T>(actor: AuthorizationActor, reason: string, work: (tx: Prisma.TransactionClient) => Promise<RbacMutationOutcome<T>>): Promise<T> {
		return this.execute(
			"authorization.rbac.mutate",
			reason,
			actor.id,
			{ kind: "USER", userId: actor.id },
			async (tx: Prisma.TransactionClient): Promise<NormalizedOutcome<T>> => {
				const outcome: RbacMutationOutcome<T> = await work(tx);
				return outcome.kind === "changed"
					? { result: outcome.result, audits: [outcome.audit], affectedUserIds: outcome.affectedUserIds }
					: { result: outcome.result, audits: [], affectedUserIds: [] };
			},
		);
	}

	/**
	 * A change made by a scheduled job. The transaction runs under `operation`,
	 * and the audit rows name that operation as their actor (`actor_kind =
	 * SYSTEM_OPERATION`, `actor_id = operation`).
	 */
	public async runAsSystemOperation<T>(operation: SystemOperation, reason: string, work: (tx: Prisma.TransactionClient) => Promise<RbacSystemMutationOutcome<T>>): Promise<T> {
		return this.execute(operation, reason, null, { kind: "SYSTEM_OPERATION", operation }, work);
	}

	private async execute<T>(
		operation: SystemOperation,
		reason: string,
		actorUserId: string | null,
		actor: AuditActor,
		work: (tx: Prisma.TransactionClient) => Promise<NormalizedOutcome<T>>,
	): Promise<T> {
		const outcome: NormalizedOutcome<T> = await this.tenantTx.withSystemOperation(
			{ operation, reason, actorUserId },
			async (tx: Prisma.TransactionClient): Promise<NormalizedOutcome<T>> => {
				await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RBAC_MUTATION_ADVISORY_LOCK_KEY})`;
				const produced: NormalizedOutcome<T> = await work(tx);
				if (produced.audits.length > 0) {
					// The actor's id, or the system marker for a scheduled change (an expired temporary permission).
					const revoker: SessionRevoker = actorUserId === null ? revokedBySystem("system:rbac-mutation") : revokedByUser(actorUserId);
					await this.sessionRevocation.revokeWithinTransaction(produced.affectedUserIds, revoker, tx);
					for (const draft of produced.audits) {
						await this.audit.record({ ...draft, actor }, tx);
					}
				}
				return produced;
			},
		);

		const affected: string[] = [...new Set<string>(outcome.affectedUserIds)];
		if (outcome.audits.length > 0 && affected.length > 0) {
			await this.sessionRevocation.afterRevocationCommitted(affected, "rbac_mutation");
			this.events.emitUsersMeInvalidate(affected);
		}
		return outcome.result;
	}
}
