import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, ForgotPasswordResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { PasswordResetToken } from "../../../domain/entities/password-reset-token.entity";
import { EmailAddress } from "../../../domain/value-objects/email-address.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { AuthFlowSubjectPort } from "../../ports/auth-flow.port";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import { AUTH_FLOW_SUBJECT, CREDENTIAL_CRYPTO, ID_GENERATOR, IDENTITY_UNIT_OF_WORK, PASSWORD_RESET_REQUEST_OPERATION } from "../../ports/identity.tokens";
import { RequestPasswordResetCommand } from "./request-password-reset.command";

/** The same answer whether or not the email exists (no account enumeration). */
export const FORGOT_PASSWORD_RESPONSE: ForgotPasswordResponse = { message: "If an account with that email exists, a password reset link has been sent." };

@CommandHandler(RequestPasswordResetCommand)
export class RequestPasswordResetHandler implements ICommandHandler<RequestPasswordResetCommand, ForgotPasswordResponse> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(AUTH_FLOW_SUBJECT) private readonly flowSubject: AuthFlowSubjectPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RequestPasswordResetCommand): Promise<ForgotPasswordResponse> {
		const email: EmailAddress = EmailAddress.of(command.input.email);
		const rawToken: string = this.crypto.generateRandomToken();
		const tokenHash: string = await this.crypto.hash(rawToken);
		const tokenDigest: string = this.crypto.hashTokenDigest(rawToken);

		await this.uow.runSystemOperation(PASSWORD_RESET_REQUEST_OPERATION, command.actor, async (scope: IdentityScope): Promise<void> => {
			const account: UserAccount | null = await scope.accounts.findByEmail(email);
			if (account !== null) {
				this.flowSubject.identify(account.id);
			}
			if (account?.canResetPassword() !== true) {
				return;
			}
			const now: EpochMs = this.clock.now();
			// One transaction: every older open link expires, the new one is stored, the email is requested.
			await scope.resetTokens.expireOpenTokensOf(account.id, now);
			await scope.resetTokens.add(PasswordResetToken.issue({ id: this.ids.next(), userId: account.id, tokenHash, tokenDigest }, now));
			await scope.emails.sendPasswordResetEmail(email.value, rawToken, command.input.clientType);
		});
		return FORGOT_PASSWORD_RESPONSE;
	}
}
