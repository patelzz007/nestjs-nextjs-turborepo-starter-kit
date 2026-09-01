import { Injectable, UnauthorizedException } from "@nestjs/common";
import { epochMs, type EpochMs } from "@workspace/shared";

import { LogService } from "../../../modules/logs/logs.service";
import { UserRepository } from "../repositories/user.repository";
import { EmailService } from "./email.service";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Handles brute-force protection: checking lockout status, incrementing
 * failed attempts, locking accounts, and resetting counters on success.
 *
 * Flow events are handled by the `@TrackAuthFlow` decorator on the
 * calling service — this service only manages the database state and
 * throws exceptions when lockout conditions are met.
 */
@Injectable()
export class AccountLockoutService {
	constructor(
		private readonly userRepo: UserRepository,
		private readonly emailService: EmailService,
		private readonly logService: LogService,
	) {}

	/**
	 * Check if the account is currently locked. Throws if locked.
	 */
	public async checkLockout(
		user: { readonly id: string; readonly lockedUntil: bigint | null } | null,
		_clientType: string | undefined,
		_flowStartedAt: number,
	): Promise<void> {
		if (user?.lockedUntil && user.lockedUntil > Date.now()) {
			const remainingMs: number = Number(user.lockedUntil) - Date.now();
			const remainingSec: number = Math.max(1, Math.ceil(remainingMs / 1000));
			const remainingMin: number = Math.ceil(remainingSec / 60);

			throw new UnauthorizedException({
				message: `Account temporarily locked. Try again in ${String(remainingMin)} minute(s).`,
				error: "ACCOUNT_LOCKED",
				lockedUntil: epochMs(Number(user.lockedUntil)),
				remainingSeconds: remainingSec,
			});
		}
	}

	/**
	 * Increment the failed login attempt counter. If the threshold is crossed,
	 * lock the account and send a lockout notification email.
	 */
	public async recordFailedAttempt(
		user: { readonly id: string; readonly email: string; readonly failedLoginAttempts: number },
		_clientType: string | undefined,
		_flowStartedAt: number,
	): Promise<void> {
		const shouldLock: boolean = user.failedLoginAttempts + 1 >= MAX_FAILED_ATTEMPTS;
		const lockedUntil: EpochMs = epochMs(Date.now() + LOCK_DURATION_MS);

		await this.userRepo.update(user.id, {
			failedLoginAttempts: { increment: 1 },
			lockedUntil: shouldLock ? lockedUntil : undefined,
		});

		if (shouldLock) {
			await this.emailService.sendAccountLockedEmail(user.email, lockedUntil);

			this.logService.info("Account locked due to failed login attempts", {
				userId: user.id,
				context: "AccountLockoutService",
				metadata: { email: user.email },
			});
		}

		throw new UnauthorizedException({
			message: "Invalid email or password",
			error: "INVALID_CREDENTIALS",
		});
	}

	/**
	 * Reset failed login attempts after a successful login.
	 */
	public async resetAttempts(userId: string): Promise<void> {
		const state = await this.userRepo.findLockoutState(userId);

		if (state && (state.failedLoginAttempts > 0 || state.lockedUntil)) {
			await this.userRepo.update(userId, {
				failedLoginAttempts: 0,
				lockedUntil: null,
			});
		}
	}
}
