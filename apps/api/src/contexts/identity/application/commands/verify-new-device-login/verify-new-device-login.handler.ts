import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { LoginRestrictedEnrollmentResponse, LoginServiceResponse } from "@workspace/shared";

import { InvalidLoginVerificationCodeError, LoginVerificationAttemptsExceededError, LoginVerificationExpiredError } from "../../../domain/errors/identity.errors";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import { CREDENTIAL_CRYPTO, LOGIN_VERIFICATION_STORE } from "../../ports/identity.tokens";
import type { LoginVerificationStorePort } from "../../ports/login-verification-store.port";
import { LOGIN_VERIFICATION_TTL_MS, LoginVerificationGate, MAX_LOGIN_VERIFICATION_ATTEMPTS } from "../../services/login-verification.gate";
import { SIGN_IN_METHOD_WITH_NEW_DEVICE_CODE } from "../../services/pending-sign-in";
import { SessionIssuer } from "../../services/session-issuer";
import { VerifyNewDeviceLoginCommand } from "./verify-new-device-login.command";

type VerifiedLogin = LoginServiceResponse | LoginRestrictedEnrollmentResponse;

/**
 * Completes a login with the emailed new-device code. D20: every attempt is counted with ONE atomic
 * increment before the code is compared, so concurrent guesses can never exceed
 * {@link MAX_LOGIN_VERIFICATION_ATTEMPTS} comparisons; the next attempt is refused with 429.
 */
@CommandHandler(VerifyNewDeviceLoginCommand)
export class VerifyNewDeviceLoginHandler implements ICommandHandler<VerifyNewDeviceLoginCommand, VerifiedLogin> {
	private readonly logger: Logger = new Logger(VerifyNewDeviceLoginHandler.name);

	public constructor(
		@Inject(LOGIN_VERIFICATION_STORE) private readonly store: LoginVerificationStorePort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		private readonly gate: LoginVerificationGate,
		private readonly sessions: SessionIssuer,
	) {}

	public async execute(command: VerifyNewDeviceLoginCommand): Promise<VerifiedLogin> {
		const { actor, input } = command;
		const record = await this.store.findChallenge(input.verificationId);
		if (record === null) {
			throw new LoginVerificationExpiredError();
		}
		if (record === "corrupt") {
			await this.store.deleteChallenge(input.verificationId);
			throw new LoginVerificationExpiredError();
		}

		const attempt: number = await this.store.incrementAttempts(input.verificationId, LOGIN_VERIFICATION_TTL_MS);
		if (attempt > MAX_LOGIN_VERIFICATION_ATTEMPTS) {
			await this.store.deleteChallenge(input.verificationId);
			throw new LoginVerificationAttemptsExceededError();
		}
		if (!(await this.crypto.compare(input.code, record.codeHash))) {
			throw new InvalidLoginVerificationCodeError();
		}

		await this.store.deleteChallenge(input.verificationId);
		await this.gate.rememberVerifiedDevice(record.userId, record.deviceInfo);
		this.logger.log({ event: "auth.login_verification.succeeded", userId: record.userId, verificationId: input.verificationId });

		return this.sessions.issue(actor, record.userId, record.clientType ?? undefined, {
			device: input.device,
			signInMethod: SIGN_IN_METHOD_WITH_NEW_DEVICE_CODE[record.signInMethod],
		});
	}
}
