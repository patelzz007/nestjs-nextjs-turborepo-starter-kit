import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	assertNever,
	type EmailSendResult,
	type LoginRestrictedEnrollmentResponse,
	type LoginServiceResponse,
	type LoginVerificationPendingResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import type { UserAccount } from "../../domain/aggregates/user-account.aggregate";
import { LoginVerificationSessionInvalidError } from "../../domain/errors/identity.errors";
import type { IdentityScope } from "../identity-scope";
import type { CredentialCryptoPort } from "../ports/credential-crypto.port";
import type { IdentitySettings } from "../ports/identity-settings.port";
import { CREDENTIAL_CRYPTO, IDENTITY_SETTINGS, IDENTITY_UNIT_OF_WORK, LOGIN_VERIFICATION_STORE, PUBLIC_AUTH_FLOW_OPERATION } from "../ports/identity.tokens";
import type { LoginVerificationRecord, LoginVerificationStorePort } from "../ports/login-verification-store.port";
import type { PendingLoginContext } from "./pending-sign-in";
import { SessionIssuer } from "./session-issuer";

/** Milliseconds per second / per day; seconds per minute. */
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MS_PER_DAY = 24 * 60 * 60 * MS_PER_SECOND;

/** How long an emailed new-device code works: 10 minutes. */
const VERIFICATION_TTL_SECONDS = 600;
export const LOGIN_VERIFICATION_TTL_MS = VERIFICATION_TTL_SECONDS * MS_PER_SECOND;

/** The code lifetime the email states, in minutes. */
export const LOGIN_VERIFICATION_TTL_MINUTES = VERIFICATION_TTL_SECONDS / SECONDS_PER_MINUTE;

/** Days a verified device (and a recent verification) is remembered in `new-device` mode. */
const RECOGNITION_DAYS = 7;
export const RECOGNIZED_DEVICE_TTL_MS = RECOGNITION_DAYS * MS_PER_DAY;

/** Codes one verification accepts, counted atomically (D20); the next one is refused with 429. */
export const MAX_LOGIN_VERIFICATION_ATTEMPTS = 5;

/** Digits of the emailed code. */
export const LOGIN_VERIFICATION_CODE_LENGTH = 6;

/** The device key of a sign-in that sent no User-Agent. */
const UNKNOWN_DEVICE_KEY = "unknown-device";

/** The key a device is recognized by (its User-Agent). */
export function deviceKeyOf(deviceInfo: string | null): string {
	return deviceInfo ?? UNKNOWN_DEVICE_KEY;
}

/**
 * The step after every credential check of a login: either a session is issued now, or (by
 * `LOGIN_VERIFICATION_MODE`) a one-time code is emailed and the session waits for
 * `POST /auth/verify-login`.
 */
@Injectable()
export class LoginVerificationGate {
	private readonly logger: Logger = new Logger(LoginVerificationGate.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(LOGIN_VERIFICATION_STORE) private readonly store: LoginVerificationStorePort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly sessions: SessionIssuer,
	) {}

	public async continueLogin(
		actor: ActorContext,
		context: PendingLoginContext,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		if (!(await this.needsVerification(context.userId, context.deviceInfo))) {
			return this.sessions.issue(
				actor,
				context.userId,
				context.clientType ?? undefined,
				{ device: context.device, signInMethod: context.signInMethod },
				{ mfaAssured: context.mfaAssured },
			);
		}
		return this.createChallenge(actor, context);
	}

	private async createChallenge(actor: ActorContext, context: PendingLoginContext): Promise<LoginVerificationPendingResponse> {
		const verificationCode: string = this.crypto.generateNumericCode(LOGIN_VERIFICATION_CODE_LENGTH);
		const record: LoginVerificationRecord = {
			userId: context.userId,
			codeHash: await this.crypto.hash(verificationCode),
			clientType: context.clientType,
			deviceInfo: context.deviceInfo,
			ipAddress: context.ipAddress,
			signInMethod: context.signInMethod,
		};
		const verificationId: string = this.crypto.generateRandomToken();

		const emailResult: EmailSendResult = await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, async (scope: IdentityScope): Promise<EmailSendResult> => {
			const account: UserAccount | null = await scope.accounts.findById(context.userId);
			if (account === null) {
				throw new LoginVerificationSessionInvalidError();
			}
			await this.store.saveChallenge(verificationId, record, LOGIN_VERIFICATION_TTL_MS);
			return scope.emails.sendLoginVerificationEmail(account.email.value, verificationCode, context.deviceInfo ?? "Unknown device", context.ipAddress ?? "Unknown IP");
		});

		if (emailResult.ok) {
			this.logger.log({ event: "auth.login_verification.email_dispatched", userId: context.userId, verificationId, mode: emailResult.mode });
		} else {
			this.logger.warn({ event: "auth.login_verification.email_failed", userId: context.userId, reason: emailResult.reason, detail: emailResult.detail ?? null });
		}

		return { requiresVerification: true, verificationId, message: "Verification code sent to your email" };
	}

	private async needsVerification(userId: string, deviceInfo: string | null): Promise<boolean> {
		const mode = this.settings.loginVerificationMode;
		switch (mode) {
			case "disabled":
				return false;
			case "always":
				return true;
			case "new-device":
				return !(await this.store.wasRecentlyVerified(userId)) && !(await this.store.isDeviceRecognized(userId, deviceKeyOf(deviceInfo)));
			default:
				return assertNever(mode, "login verification mode");
		}
	}

	/** After a verified code: this device (and the user) is recognized for {@link RECOGNIZED_DEVICE_TTL_MS}. */
	public async rememberVerifiedDevice(userId: string, deviceInfo: string | null): Promise<void> {
		await this.store.markDeviceRecognized(userId, deviceKeyOf(deviceInfo), RECOGNIZED_DEVICE_TTL_MS);
		await this.store.markRecentlyVerified(userId, this.clock.now(), RECOGNIZED_DEVICE_TTL_MS);
	}
}
