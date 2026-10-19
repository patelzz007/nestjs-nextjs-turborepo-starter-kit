import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type {
	EpochMs,
	LoginRestrictedEnrollmentResponse,
	LoginServiceResponse,
	LoginTwoFactorPendingResponse,
	LoginVerificationPendingResponse,
	UserPermissions,
} from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { USER_GRANTS_READ, type UserGrantsReadPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { TwoFactorLoginChallenge } from "../../../domain/aggregates/two-factor-login-challenge.aggregate";
import type { PasswordSignInDecision, UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { InvalidCredentialsError } from "../../../domain/errors/identity.errors";
import { EmailAddress } from "../../../domain/value-objects/email-address.value-object";
import type { FailedSignInOutcome } from "../../../domain/value-objects/lockout-state.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { AuthFlowSubjectPort } from "../../ports/auth-flow.port";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import type { IdentityTokensPort } from "../../ports/identity-tokens.port";
import { AUTH_FLOW_SUBJECT, CREDENTIAL_CRYPTO, ID_GENERATOR, IDENTITY_TOKENS, IDENTITY_UNIT_OF_WORK, PUBLIC_AUTH_FLOW_OPERATION } from "../../ports/identity.tokens";
import { LoginVerificationGate } from "../../services/login-verification.gate";
import { hasAdminAccess } from "../../services/user-response.assembler";
import { LogInCommand } from "./log-in.command";

/** Hashed for every login so an unknown email costs the same time as a wrong password (no account enumeration by timing). */
const TIMING_EQUALIZER_PASSWORD = "dummy-password-to-prevent-timing-attack";

type LoginResult = LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginTwoFactorPendingResponse | LoginVerificationPendingResponse;

@CommandHandler(LogInCommand)
export class LogInHandler implements ICommandHandler<LogInCommand, LoginResult> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
		@Inject(USER_GRANTS_READ) private readonly grants: UserGrantsReadPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(AUTH_FLOW_SUBJECT) private readonly flowSubject: AuthFlowSubjectPort,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly verification: LoginVerificationGate,
	) {}

	public async execute(command: LogInCommand): Promise<LoginResult> {
		const { actor, input } = command;
		const email: EmailAddress = EmailAddress.of(input.body.email);
		const account: UserAccount | null = await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, (scope) => scope.accounts.findByEmail(email));
		if (account !== null) {
			this.flowSubject.identify(account.id);
		}

		const timingHash: string = await this.crypto.hash(TIMING_EQUALIZER_PASSWORD);
		const passwordMatches: boolean = await this.crypto.compare(input.body.password, account?.passwordHash ?? timingHash);
		const now: EpochMs = this.clock.now();
		if (account === null) {
			throw new InvalidCredentialsError();
		}

		const decision: PasswordSignInDecision = account.evaluatePasswordSignIn(passwordMatches, now);
		if (decision === "locked") {
			throw new InvalidCredentialsError();
		}
		if (decision === "rejected") {
			await this.countFailedAttempt(command, account, now);
			throw new InvalidCredentialsError();
		}

		// Admin panel sign-in: uniform INVALID_CREDENTIALS for an account without dashboard access (no capability probing).
		if (input.clientType === "admin" && !account.isSuperAdmin) {
			const permissions: UserPermissions = await this.grants.getUserPermissionDetails(account.id);
			if (!hasAdminAccess(account, permissions)) {
				throw new InvalidCredentialsError();
			}
		}

		if (!account.twoFactorEnabled) {
			await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, (scope) => scope.accounts.resetLockout(account.id, now));
			return this.verification.continueLogin(actor, {
				userId: account.id,
				clientType: input.clientType ?? null,
				deviceInfo: input.device.userAgent,
				ipAddress: input.device.ipAddress,
				signInMethod: "PASSWORD",
				device: input.device,
			});
		}

		const challenge: TwoFactorLoginChallenge = TwoFactorLoginChallenge.open(
			{
				id: this.ids.next(),
				userId: account.id,
				purpose: "LOGIN",
				clientType: input.clientType ?? null,
				deviceInfo: input.device.userAgent,
				ipAddress: input.device.ipAddress,
			},
			now,
		);
		await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, (scope) => scope.challenges.add(challenge));
		const state = challenge.snapshot;
		const tempToken: string = await this.tokens.signChallengeRef({
			sub: state.userId,
			challengeId: state.id,
			purpose: state.purpose,
			clientType: state.clientType,
			deviceInfo: state.deviceInfo,
			ipAddress: state.ipAddress,
		});
		return { requiresTwoFactor: true, tempToken, message: "Two-factor authentication required" };
	}

	/** D19: one atomic statement counts the failure and takes the lock; the attempt that locked it sends the notice. */
	private async countFailedAttempt(command: LogInCommand, account: UserAccount, now: EpochMs): Promise<void> {
		await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, command.actor, async (scope: IdentityScope): Promise<void> => {
			const outcome: FailedSignInOutcome | null = await scope.accounts.recordFailedSignIn(account.id, now);
			if (outcome?.lockedNow === true && outcome.state.lockedUntil !== null) {
				await scope.emails.sendAccountLockedEmail(account.email.value, outcome.state.lockedUntil);
			}
		});
	}
}
