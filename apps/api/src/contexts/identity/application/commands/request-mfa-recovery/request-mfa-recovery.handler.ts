import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, MfaRecoveryStatusResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MfaRecoveryRequest } from "../../../domain/aggregates/mfa-recovery-request.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { AccountNotFoundError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import { ID_GENERATOR, IDENTITY_UNIT_OF_WORK, MFA_RECOVERY_REQUEST_OPERATION } from "../../ports/identity.tokens";
import { auditOriginOf } from "../../services/audit-origin";
import { RequestMfaRecoveryCommand } from "./request-mfa-recovery.command";

const REQUESTED_RESPONSE: MfaRecoveryStatusResponse = { status: "PENDING", message: "MFA recovery request submitted. An administrator will review it shortly." };
const USER_NOTICE_TITLE = "MFA Recovery Request Submitted";
const USER_NOTICE = "We received your MFA recovery request. A super administrator will review it shortly. You will be notified once a decision is made.";
const ADMIN_NOTICE_TITLE = "MFA Recovery Review Required";

/**
 * Opens a recovery request. One transaction under `auth.mfa_recovery.request`: a per-user advisory
 * lock serializes concurrent opens, the "one open request" check, the insert, its audit row and the
 * notices to the user and to every SuperAdmin.
 */
@CommandHandler(RequestMfaRecoveryCommand)
export class RequestMfaRecoveryHandler implements ICommandHandler<RequestMfaRecoveryCommand, MfaRecoveryStatusResponse> {
	private readonly logger: Logger = new Logger(RequestMfaRecoveryHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RequestMfaRecoveryCommand): Promise<MfaRecoveryStatusResponse> {
		const { actor, input } = command;
		const notes: string | null = input.reason ?? null;
		const requestId: string = await this.uow.runSystemOperation(MFA_RECOVERY_REQUEST_OPERATION, actor, async (scope: IdentityScope): Promise<string> => {
			const account: UserAccount | null = await scope.accounts.findById(input.userId);
			if (account === null) {
				throw new AccountNotFoundError();
			}
			await scope.mfaRecoveries.lockOpeningFor(account.id);
			const now: EpochMs = this.clock.now();
			const request: MfaRecoveryRequest = MfaRecoveryRequest.open(
				{
					id: this.ids.next(),
					userId: account.id,
					notes,
					userHasTwoFactor: account.twoFactorEnabled,
					userHasOpenRequest: await scope.mfaRecoveries.hasOpenRequest(account.id),
					origin: auditOriginOf(actor),
				},
				now,
			);
			await scope.mfaRecoveries.add(request);
			await scope.emails.sendMfaRecoveryUserNotification(account.email.value, USER_NOTICE_TITLE, USER_NOTICE);
			const adminMessage: string = [
				`User ${account.fullName} (${account.email.value}) submitted an MFA recovery request.`,
				`Request ID: ${request.id}`,
				notes !== null ? `Reason: ${notes}` : "No reason provided.",
				"",
				"Please review this request in the admin panel.",
			].join("\n");
			for (const admin of await scope.accounts.activeSuperAdminEmails()) {
				await scope.emails.sendMfaRecoveryAdminNotification(admin.value, ADMIN_NOTICE_TITLE, adminMessage);
			}
			return request.id;
		});
		this.logger.log({ event: "mfa.recovery.requested", userId: input.userId, requestId, hasReason: notes !== null });
		return REQUESTED_RESPONSE;
	}
}
