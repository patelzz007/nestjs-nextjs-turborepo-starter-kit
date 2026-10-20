import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { ChangePasswordResponse, EpochMs } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { CredentialAccountMissingError } from "../../../domain/errors/identity.errors";
import { revokedByUser } from "../../../domain/value-objects/session-revoker.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { AuthFlowSubjectPort } from "../../ports/auth-flow.port";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import { AUTH_FLOW_SUBJECT, CREDENTIAL_CRYPTO, IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { matchesRecentPassword } from "../../services/password-reuse.checker";
import { ChangePasswordCommand } from "./change-password.command";

const CHANGE_PASSWORD_RESPONSE: ChangePasswordResponse = { message: "Password changed successfully" };

/**
 * The signed-in user changes their password. D35: the account write is a compare-and-set on the
 * `tokenVersion` it was loaded with, so two concurrent changes cannot both win (the loser is 409).
 * Password, history and the sign-out of every session commit together; the credential change is
 * broadcast to every instance after commit.
 */
@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand, ChangePasswordResponse> {
	private readonly logger: Logger = new Logger(ChangePasswordHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(AUTH_FLOW_SUBJECT) private readonly flowSubject: AuthFlowSubjectPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ChangePasswordCommand): Promise<ChangePasswordResponse> {
		const { actor, input } = command;
		this.flowSubject.identify(input.userId);
		await this.uow.run(actor, async (scope: IdentityScope): Promise<void> => {
			const account: UserAccount | null = await scope.accounts.findById(input.userId);
			if (account === null) {
				throw new CredentialAccountMissingError();
			}
			account.assertCurrentPassword(await this.crypto.compare(input.currentPassword, account.passwordHash));
			const reused: boolean = await matchesRecentPassword(scope, this.crypto, account.id, input.newPassword);
			const now: EpochMs = this.clock.now();
			account.changePassword(await this.crypto.hash(input.newPassword), reused, now);
			await scope.accounts.save(account);
			// The user changed their own password: they are the actor of the sign-out.
			await scope.sessions.revokeAllOf([account.id], revokedByUser(account.id), now, null);
			await scope.emails.sendPasswordChangedEmail(account.email.value);
			scope.events.collectFrom(account);
		});
		this.logger.log({ event: "auth.password_changed", userId: input.userId });
		return CHANGE_PASSWORD_RESPONSE;
	}
}
