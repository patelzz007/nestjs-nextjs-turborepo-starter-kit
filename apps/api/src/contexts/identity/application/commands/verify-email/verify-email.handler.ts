import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { VerifyEmailResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { AccountNotFoundError, EmailAlreadyVerifiedError } from "../../../domain/errors/identity.errors";
import { EmailAddress } from "../../../domain/value-objects/email-address.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { AuthFlowSubjectPort } from "../../ports/auth-flow.port";
import type { IdentityTokensPort } from "../../ports/identity-tokens.port";
import { AUTH_FLOW_SUBJECT, IDENTITY_TOKENS, IDENTITY_UNIT_OF_WORK, PUBLIC_AUTH_FLOW_OPERATION } from "../../ports/identity.tokens";
import { VerifyEmailCommand } from "./verify-email.command";

const ALREADY_VERIFIED: VerifyEmailResponse = { message: "Email already verified", alreadyVerified: true };
const VERIFIED: VerifyEmailResponse = { message: "Email verified successfully", alreadyVerified: false };

@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler implements ICommandHandler<VerifyEmailCommand, VerifyEmailResponse> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
		@Inject(AUTH_FLOW_SUBJECT) private readonly flowSubject: AuthFlowSubjectPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: VerifyEmailCommand): Promise<VerifyEmailResponse> {
		const email: EmailAddress = EmailAddress.of(await this.tokens.verifyEmailToken(command.input.token));
		try {
			return await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, command.actor, async (scope: IdentityScope): Promise<VerifyEmailResponse> => {
				const account: UserAccount | null = await scope.accounts.findByEmail(email);
				if (account === null) {
					throw new AccountNotFoundError();
				}
				this.flowSubject.identify(account.id);
				if (!account.verifyEmail(this.clock.now())) {
					return ALREADY_VERIFIED;
				}
				await scope.accounts.save(account);
				scope.events.collectFrom(account);
				return VERIFIED;
			});
		} catch (error) {
			// A concurrent verification of the same address (double click, two tabs) committed first.
			if (error instanceof EmailAlreadyVerifiedError) {
				return ALREADY_VERIFIED;
			}
			throw error;
		}
	}
}
