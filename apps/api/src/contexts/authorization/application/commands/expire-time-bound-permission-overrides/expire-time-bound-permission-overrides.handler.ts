import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { ExpiredPermissionOverride, UserAuthorizationAggregate } from "../../../domain/aggregates/user-authorization.aggregate";
import type { AuthorizationScope } from "../../authorization-scope";
import type { PermissionAuditDraft } from "../../ports/permission-audit.port";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { ExpireTimeBoundPermissionOverridesCommand } from "./expire-time-bound-permission-overrides.command";

/** Accounts one RBAC transaction expires; a run repeats batches until the backlog is empty. */
export const PERMISSION_EXPIRY_BATCH_ACCOUNTS = 200;

/**
 * Runs through the RBAC mutation scope like every other RBAC change: one transaction under
 * `maintenance.permission_expiry` holding the RBAC lock per batch of {@link PERMISSION_EXPIRY_BATCH_ACCOUNTS}
 * accounts (so a large backlog never holds the lock for one unbounded transaction), the affected users'
 * sessions revoked, and one `PERMISSION_EXPIRED` audit row per override with the operation as the explicit actor.
 *
 * Enforcement does not depend on this job (evaluation ignores expired overrides); it makes the change
 * durable, audited and session-revoking.
 */
@CommandHandler(ExpireTimeBoundPermissionOverridesCommand)
export class ExpireTimeBoundPermissionOverridesHandler implements ICommandHandler<ExpireTimeBoundPermissionOverridesCommand, number> {
	public constructor(
		private readonly rbac: RbacMutationScope,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ExpireTimeBoundPermissionOverridesCommand): Promise<number> {
		let expired = 0;
		for (;;) {
			const batch = await this.expireBatch(command);
			expired += batch.overrides;
			if (batch.accounts < PERMISSION_EXPIRY_BATCH_ACCOUNTS) {
				return expired;
			}
		}
	}

	/** One bounded batch of accounts in one RBAC transaction; expired overrides leave the selection, so the next batch continues. */
	private async expireBatch(command: ExpireTimeBoundPermissionOverridesCommand): Promise<{ readonly accounts: number; readonly overrides: number }> {
		return this.rbac.run(
			{ kind: "system", actor: command.actor },
			async (scope: AuthorizationScope): Promise<RbacMutationOutcome<{ readonly accounts: number; readonly overrides: number }>> => {
				const now: EpochMs = this.clock.now();
				// The RBAC lock is held, so no RBAC write can revive or re-grant these rows before commit.
				const accounts: UserAuthorizationAggregate[] = await scope.userAuthorizations.findWithExpiredOverrides(now, PERMISSION_EXPIRY_BATCH_ACCOUNTS);
				const audits: PermissionAuditDraft[] = [];
				const affectedUserIds: string[] = [];
				for (const account of accounts) {
					const expired: readonly ExpiredPermissionOverride[] = account.expireOverrides(now);
					await scope.userAuthorizations.save(account);
					for (const override of expired) {
						affectedUserIds.push(account.userId);
						audits.push({
							action: "PERMISSION_EXPIRED",
							targetUserId: account.userId,
							permissionId: override.permissionId,
							detail: JSON.stringify({ effect: override.effect, expiredAt: now }),
						});
					}
				}
				const result = { accounts: accounts.length, overrides: audits.length };
				if (audits.length === 0) {
					return { kind: "unchanged", result };
				}
				return { kind: "changed", result, audits, affectedUserIds };
			},
		);
	}
}
