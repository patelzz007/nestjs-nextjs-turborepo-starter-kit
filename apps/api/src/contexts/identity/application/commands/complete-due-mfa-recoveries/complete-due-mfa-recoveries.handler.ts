import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { MfaRecoveryRequest } from "../../../domain/aggregates/mfa-recovery-request.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import type { IdentityScope } from "../../identity-scope";
import { IDENTITY_UNIT_OF_WORK, MFA_RECOVERY_UNLOCK_OPERATION } from "../../ports/identity.tokens";
import { auditOriginOf } from "../../services/audit-origin";
import { CompleteDueMfaRecoveriesCommand } from "./complete-due-mfa-recoveries.command";

/**
 * Cron: every APPROVED request whose delay elapsed completes in its OWN transaction (compare-and-set
 * on APPROVED and due, so overlapping runs on several replicas complete each request once): the
 * second factor is cleared, `tokenVersion` moves, the audit row and the user's notice are written.
 */
@CommandHandler(CompleteDueMfaRecoveriesCommand)
export class CompleteDueMfaRecoveriesHandler implements ICommandHandler<CompleteDueMfaRecoveriesCommand, number> {
	private readonly logger: Logger = new Logger(CompleteDueMfaRecoveriesHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CompleteDueMfaRecoveriesCommand): Promise<number> {
		const { actor } = command;
		const dueIds: readonly string[] = await this.uow.runSystemOperation(MFA_RECOVERY_UNLOCK_OPERATION, actor, (scope) =>
			scope.mfaRecoveries.findDueApprovedIds(this.clock.now()),
		);
		let completed = 0;
		for (const requestId of dueIds) {
			const done: boolean = await this.uow.runSystemOperation(MFA_RECOVERY_UNLOCK_OPERATION, actor, async (scope: IdentityScope): Promise<boolean> => {
				const now: EpochMs = this.clock.now();
				const request: MfaRecoveryRequest | null = await scope.mfaRecoveries.findById(requestId);
				if (request?.complete(auditOriginOf(actor), now) !== true) {
					return false;
				}
				if (!(await scope.mfaRecoveries.save(request))) {
					// Another worker completed it first.
					return false;
				}
				const account: UserAccount | null = await scope.accounts.findById(request.userId);
				if (account !== null) {
					await scope.emails.sendTwoFactorDisabledEmail(account.email.value);
				}
				scope.events.collectFrom(request);
				return true;
			});
			if (done) {
				completed += 1;
				this.logger.log({ event: "mfa.recovery.completed", requestId });
			}
		}
		return completed;
	}
}
