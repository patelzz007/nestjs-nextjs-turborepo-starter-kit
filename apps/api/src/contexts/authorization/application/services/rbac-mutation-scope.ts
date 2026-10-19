import { Inject, Injectable } from "@nestjs/common";
import type { EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import type { SessionRevocationActor } from "../../../../platform/application/ports/identity-sessions.port";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { UserAuthorizationChanged } from "../../domain/events/user-authorization-changed.event";
import type { AuthorizationScope } from "../authorization-scope";
import type { PermissionAuditActor, PermissionAuditDraft } from "../ports/permission-audit.port";
import { AUTHORIZATION_UNIT_OF_WORK, RBAC_MUTATE_OPERATION } from "../ports/authorization.tokens";

/** A mutation that changed RBAC state. */
export interface RbacMutationChanged<TResult> {
	readonly kind: "changed";
	readonly result: TResult;
	/** One audit row per change (a batch job such as the expiry writes one per retired override). Written in the same transaction. */
	readonly audits: readonly PermissionAuditDraft[];
	/** Users whose effective authorization changed: their sessions are revoked in the same transaction. */
	readonly affectedUserIds: readonly string[];
}

/** An idempotent mutation that found nothing to change: no write, so no audit row, no revocation, no event. */
export interface RbacMutationUnchanged<TResult> {
	readonly kind: "unchanged";
	readonly result: TResult;
}

export type RbacMutationOutcome<TResult> = RbacMutationChanged<TResult> | RbacMutationUnchanged<TResult>;

/** The authenticated-user variant of {@link ActorContext}. */
export type UserActor = Extract<ActorContext, { readonly kind: "user" }>;

/** The system (job, cron, bootstrap) variant of {@link ActorContext}. */
export type SystemActor = Extract<ActorContext, { readonly kind: "system" }>;

/**
 * Who an RBAC mutation runs as.
 * - `user`: an authenticated administrator (`authorization.rbac.mutate`).
 * - `self_provisioning`: an account attaching its own default role at signup (`authorization.rbac.mutate`,
 *   audited as that account). `actor` is the request's own (anonymous) actor.
 * - `system`: a scheduled job, under its own allowlisted operation, audited as that operation.
 */
export type RbacPrincipal =
	| { readonly kind: "user"; readonly actor: UserActor }
	| { readonly kind: "self_provisioning"; readonly userId: string; readonly actor: ActorContext }
	| { readonly kind: "system"; readonly actor: SystemActor };

/** The system marker written to `deletedBy` of sessions an RBAC job revoked. */
const SYSTEM_RBAC_REVOKER: SessionRevocationActor = { kind: "system", marker: "system:rbac-mutation" };

/**
 * THE one way RBAC state changes (§7.7 `RbacMutationScope`). Inside ONE `runSystemOperation`:
 *
 * 1. the RBAC advisory lock, so every check the work performs (escalation subset, separation of duties,
 *    last protected holder) reads state no concurrent RBAC write can change before commit;
 * 2. the work: domain policies, then the write;
 * 3. revocation of every affected user's sessions through identity's `IdentitySessionsPort`;
 * 4. the `PermissionAuditLog` row(s) with the explicit actor;
 * 5. `UserAuthorizationChanged` recorded for after-commit cache invalidation (Redis `authz:invalidate`).
 *
 * Any failure, an audit insert included, rolls everything back and publishes nothing.
 */
@Injectable()
export class RbacMutationScope {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async run<TResult>(principal: RbacPrincipal, work: (scope: AuthorizationScope) => Promise<RbacMutationOutcome<TResult>>): Promise<TResult> {
		return this.uow.runSystemOperation(operationOf(principal), principal.actor, async (scope: AuthorizationScope): Promise<TResult> => {
			await scope.rbacLock.acquire();
			const outcome: RbacMutationOutcome<TResult> = await work(scope);
			if (outcome.kind === "unchanged" || outcome.audits.length === 0) {
				return outcome.result;
			}
			const affected: string[] = [...new Set<string>(outcome.affectedUserIds)];
			await scope.identitySessions.revokeAllSessions(affected, revokerOf(principal));
			const auditActor: PermissionAuditActor = auditActorOf(principal);
			for (const draft of outcome.audits) {
				await scope.permissionAudit.append({ ...draft, actor: auditActor });
			}
			if (affected.length > 0) {
				const now: EpochMs = this.clock.now();
				scope.events.collect(new UserAuthorizationChanged(now, affected));
			}
			return outcome.result;
		});
	}
}

function operationOf(principal: RbacPrincipal): SystemOperationName {
	return principal.kind === "system" ? principal.actor.operation : RBAC_MUTATE_OPERATION;
}

function auditActorOf(principal: RbacPrincipal): PermissionAuditActor {
	if (principal.kind === "system") {
		return { kind: "SYSTEM_OPERATION", operation: principal.actor.operation };
	}
	return { kind: "USER", userId: principal.kind === "user" ? principal.actor.userId : principal.userId };
}

function revokerOf(principal: RbacPrincipal): SessionRevocationActor {
	if (principal.kind === "system") {
		return SYSTEM_RBAC_REVOKER;
	}
	return { kind: "user", userId: principal.kind === "user" ? principal.actor.userId : principal.userId };
}
