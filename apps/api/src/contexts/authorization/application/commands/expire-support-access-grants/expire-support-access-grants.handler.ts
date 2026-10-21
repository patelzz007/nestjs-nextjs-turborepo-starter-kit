import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { AuthorizationScope } from "../../authorization-scope";
import { AUTHORIZATION_UNIT_OF_WORK, SUPPORT_ACCESS_EXPIRY_OPERATION } from "../../ports/authorization.tokens";
import { ExpireSupportAccessGrantsCommand, type SupportAccessExpiryResult } from "./expire-support-access-grants.command";

/** Grants one transaction expires; a run repeats batches until none is due. */
export const SUPPORT_ACCESS_EXPIRY_BATCH = 200;

/**
 * One transaction per batch under `maintenance.support_access_expiry`: the due grants are row-locked
 * (`SKIP LOCKED`), each is compared-and-set from the status it was loaded with to EXPIRED, so a grant
 * revoked or approved meanwhile is never overwritten. Verification already ignores an expired grant;
 * this makes its end durable. The run is audited by the system-command dispatcher (with the expired
 * ids) and every row change by the data-change trail — a tenant audit row needs a human actor, and
 * there is none.
 */
@CommandHandler(ExpireSupportAccessGrantsCommand)
export class ExpireSupportAccessGrantsHandler implements ICommandHandler<ExpireSupportAccessGrantsCommand, SupportAccessExpiryResult> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ExpireSupportAccessGrantsCommand): Promise<SupportAccessExpiryResult> {
		const grantIds: string[] = [];
		for (;;) {
			const batch = await this.expireBatch(command);
			grantIds.push(...batch.expiredIds);
			if (batch.loaded < SUPPORT_ACCESS_EXPIRY_BATCH) {
				return { expired: grantIds.length, grantIds };
			}
		}
	}

	private expireBatch(command: ExpireSupportAccessGrantsCommand): Promise<{ readonly loaded: number; readonly expiredIds: readonly string[] }> {
		return this.uow.runSystemOperation(SUPPORT_ACCESS_EXPIRY_OPERATION, command.actor, async (scope: AuthorizationScope) => {
			const now: EpochMs = this.clock.now();
			const due = await scope.supportGrants.findDueForExpiry(now, SUPPORT_ACCESS_EXPIRY_BATCH);
			const expiredIds: string[] = [];
			for (const grant of due) {
				if (grant.expire(now) && (await scope.supportGrants.save(grant)) === "saved") {
					expiredIds.push(grant.id);
				}
			}
			return { loaded: due.length, expiredIds };
		});
	}
}
