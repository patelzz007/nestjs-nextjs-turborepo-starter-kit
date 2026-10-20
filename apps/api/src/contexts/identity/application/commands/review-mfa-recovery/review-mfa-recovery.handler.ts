import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { MfaRecoveryStatusResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { MfaRecoveryDecision, MfaRecoveryRequest } from "../../../domain/aggregates/mfa-recovery-request.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { MfaRecoveryNotFoundError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { IdentitySettings } from "../../ports/identity-settings.port";
import { IDENTITY_SETTINGS, IDENTITY_UNIT_OF_WORK, MFA_RECOVERY_REVIEW_OPERATION } from "../../ports/identity.tokens";
import { auditOriginOf } from "../../services/audit-origin";
import { toMfaRecoveryStatusResponse } from "../../services/mfa-recovery-status";
import { ReviewMfaRecoveryCommand } from "./review-mfa-recovery.command";

/** Milliseconds per hour — renders the recovery delay in the approval email. */
const MS_PER_HOUR = 3_600_000;

const DECISIONS: Readonly<Record<"approve" | "deny", MfaRecoveryDecision>> = { approve: "APPROVED", deny: "DENIED" };

/**
 * A SuperAdmin approves or denies a PENDING request: compare-and-set on PENDING (two concurrent
 * reviews cannot both win), its audit row, and the requester's notice, in one transaction.
 */
@CommandHandler(ReviewMfaRecoveryCommand)
export class ReviewMfaRecoveryHandler implements ICommandHandler<ReviewMfaRecoveryCommand, MfaRecoveryStatusResponse> {
	private readonly logger: Logger = new Logger(ReviewMfaRecoveryHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReviewMfaRecoveryCommand): Promise<MfaRecoveryStatusResponse> {
		const { actor, input } = command;
		const decision: MfaRecoveryDecision = DECISIONS[input.decision];
		const response = await this.uow.runSystemOperation(MFA_RECOVERY_REVIEW_OPERATION, actor, async (scope: IdentityScope): Promise<MfaRecoveryStatusResponse> => {
			const request: MfaRecoveryRequest | null = await scope.mfaRecoveries.findById(input.requestId);
			if (request === null) {
				throw new MfaRecoveryNotFoundError();
			}
			const reviewer: UserAccount | null = request.userId === input.reviewerId ? null : await scope.accounts.findById(input.reviewerId);
			request.review(
				{ userId: input.reviewerId, isEligibleSuperAdmin: reviewer !== null && reviewer.isSuperAdmin && reviewer.canSignIn() },
				decision,
				{ recoveryDelayMs: this.settings.mfaRecoveryDelayMs, notes: input.notes, origin: auditOriginOf(actor) },
				this.clock.now(),
			);
			await scope.mfaRecoveries.save(request);
			const requester: UserAccount | null = await scope.accounts.findById(request.userId);
			if (requester !== null) {
				await scope.emails.sendMfaRecoveryUserNotification(requester.email.value, ...this.requesterNotice(decision));
			}
			return toMfaRecoveryStatusResponse(request.snapshot);
		});
		this.logger.log({ event: "mfa.recovery.reviewed", requestId: input.requestId, decision, reviewedBy: input.reviewerId });
		return response;
	}

	private requesterNotice(decision: MfaRecoveryDecision): [string, string] {
		if (decision === "APPROVED") {
			const delayHours: number = Math.round(this.settings.mfaRecoveryDelayMs / MS_PER_HOUR);
			return ["MFA Recovery Approved", `Your MFA recovery request was approved. MFA will be disabled after a ${String(delayHours)}-hour security delay.`];
		}
		return ["MFA Recovery Denied", "Your MFA recovery request was denied. If you still need help, please contact support."];
	}
}
