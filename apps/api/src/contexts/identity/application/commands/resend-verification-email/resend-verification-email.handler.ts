import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { ResendVerificationResponse } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { EmailAddress } from "../../../domain/value-objects/email-address.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { IdentityTokensPort } from "../../ports/identity-tokens.port";
import { IDENTITY_TOKENS, IDENTITY_UNIT_OF_WORK, PUBLIC_AUTH_FLOW_OPERATION } from "../../ports/identity.tokens";
import { ResendVerificationEmailCommand } from "./resend-verification-email.command";

/** The same answer whether or not the account exists (no email enumeration). */
export const RESEND_VERIFICATION_RESPONSE: ResendVerificationResponse = { message: "If an account with that email exists, a verification email has been sent." };

@CommandHandler(ResendVerificationEmailCommand)
export class ResendVerificationEmailHandler implements ICommandHandler<ResendVerificationEmailCommand, ResendVerificationResponse> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
	) {}

	public async execute(command: ResendVerificationEmailCommand): Promise<ResendVerificationResponse> {
		const email: EmailAddress = EmailAddress.of(command.input.email);
		await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, command.actor, async (scope: IdentityScope): Promise<void> => {
			const account: UserAccount | null = await scope.accounts.findByEmail(email);
			if (account?.awaitsEmailVerification() !== true) {
				return;
			}
			await scope.emails.sendVerificationEmail(email.value, await this.tokens.generateEmailVerificationToken(email.value), command.input.clientType);
		});
		return RESEND_VERIFICATION_RESPONSE;
	}
}
