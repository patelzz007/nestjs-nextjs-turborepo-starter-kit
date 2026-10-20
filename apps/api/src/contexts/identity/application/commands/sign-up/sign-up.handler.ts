import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, type EpochMs, type SignupResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { SIGNUP_REFERRALS, type AcceptedSignupReferral, type SignupReferralPort } from "../../../../referrals/public-api";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { EmailAlreadyRegisteredError } from "../../../domain/errors/identity.errors";
import { EmailAddress } from "../../../domain/value-objects/email-address.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { AuthFlowSubjectPort } from "../../ports/auth-flow.port";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import type { IdentitySettings } from "../../ports/identity-settings.port";
import type { IdentityTokensPort } from "../../ports/identity-tokens.port";
import {
	AUTH_FLOW_SUBJECT,
	CREDENTIAL_CRYPTO,
	ID_GENERATOR,
	IDENTITY_SETTINGS,
	IDENTITY_TOKENS,
	IDENTITY_UNIT_OF_WORK,
	ACCOUNT_LOOKUP_OPERATION,
	SIGNUP_REGISTER_OPERATION,
} from "../../ports/identity.tokens";
import { SignUpCommand } from "./sign-up.command";

/**
 * The one signup answer whether or not the email was free (and whether or not a concurrent request
 * took it first), so signup is not an account oracle.
 */
export const GENERIC_SIGNUP_RESPONSE: SignupResponse = {
	message: "If this email is available, check your inbox for verification instructions.",
};

@CommandHandler(SignUpCommand)
export class SignUpHandler implements ICommandHandler<SignUpCommand, SignupResponse> {
	private readonly logger: Logger = new Logger(SignUpHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(SIGNUP_REFERRALS) private readonly signupReferrals: SignupReferralPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(AUTH_FLOW_SUBJECT) private readonly flowSubject: AuthFlowSubjectPort,
		@Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: SignUpCommand): Promise<SignupResponse> {
		const { actor, input } = command;
		const email: EmailAddress = EmailAddress.of(input.body.email);

		// The code is checked before the taken-email disguise: a bad code is a validation error,
		// never a generic "check your inbox" (ADR 035).
		const accepted: AcceptedSignupReferral | null = await this.signupReferrals.acceptCodeForSignup(input.body.referralCode, input.clientType);

		const emailTaken: boolean = await this.uow.runSystemOperation(ACCOUNT_LOOKUP_OPERATION, actor, (scope) => scope.accounts.existsByEmail(email));
		if (emailTaken) {
			return GENERIC_SIGNUP_RESPONSE;
		}

		const passwordHash: string = await this.crypto.hash(input.body.password);
		const verificationToken: string = await this.tokens.generateEmailVerificationToken(email.value);
		const now: EpochMs = this.clock.now();
		const account: UserAccount = UserAccount.register(
			{
				id: this.ids.next(),
				email,
				fullName: input.body.fullName,
				passwordHash,
				isSuperAdmin: false,
				emailVerifiedAt: null,
				mfaEnrollmentDeadline: epochMs(now + this.settings.mfaEnrollmentGraceMs),
			},
			now,
		);

		try {
			await this.uow.runSystemOperation(SIGNUP_REGISTER_OPERATION, actor, async (scope: IdentityScope): Promise<void> => {
				await scope.accounts.add(account);
				await scope.signupReferrals.issueFirstCode(account.id, now);
				if (accepted !== null) {
					await scope.signupReferrals.attachSignupReferral(accepted, { id: account.id, createdAt: now });
				}
				// D14: the default role commits with the account — a role failure leaves no account.
				await scope.roles.assignDefaultRole(account.id);
				await scope.emails.sendVerificationEmail(email.value, verificationToken, input.clientType);
				scope.events.collectFrom(account);
			});
		} catch (error) {
			// A concurrent signup with the same email committed first: same generic answer, nothing created.
			if (error instanceof EmailAlreadyRegisteredError) {
				return GENERIC_SIGNUP_RESPONSE;
			}
			throw error;
		}

		this.flowSubject.identify(account.id);
		this.logger.log({ event: "auth.signup", userId: account.id });
		return GENERIC_SIGNUP_RESPONSE;
	}
}
