import { epochMs, type EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import {
	BackupCodeRejectedError,
	InvalidRotationPasswordError,
	InvalidTotpTokenError,
	TwoFactorAlreadyEnabledError,
	TwoFactorNotConfiguredError,
	TwoFactorNotEnabledError,
	TwoFactorNotEnabledForLoginError,
	TwoFactorSetupExpiredError,
} from "../errors/identity.errors";
import { UserCredentialsChanged, type IdentityEvent } from "../events/identity.events";
import type { TokenVersion } from "../value-objects/token-version.value-object";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

/** Milliseconds per minute. */
const MS_PER_MINUTE = 60_000;

/** Minutes a started (unconfirmed) enrollment stays valid. */
const SETUP_TTL_MINUTES = 15;

/** How long a pending setup can be confirmed, in milliseconds. */
export const TWO_FACTOR_SETUP_TTL_MS = SETUP_TTL_MINUTES * MS_PER_MINUTE;

/** A TOTP secret encrypted at rest (AES-256-GCM with a versioned key). */
export interface EncryptedTotpSecret {
	readonly ciphertext: string;
	readonly iv: string;
	readonly keyVersion: number;
}

/** A started enrollment: the secret and the backup-code hashes awaiting the first valid code. */
export interface PendingTwoFactorSetup {
	readonly secret: EncryptedTotpSecret;
	readonly backupCodeHashes: readonly string[];
	readonly expiresAt: EpochMs;
}

/** One unused, live backup code of the account. */
export interface ActiveBackupCode {
	readonly id: string;
	readonly codeHash: string;
}

/** The result of checking a TOTP code against a secret. */
export type TotpVerification = { readonly valid: true; readonly timeStep: number } | { readonly valid: false };

/** The proof a rotation presents besides the password. */
export type RotationSecondFactor =
	| { readonly kind: "totp"; readonly verification: TotpVerification }
	| { readonly kind: "backup_code"; readonly matchedCodeId: string | null };

export interface TwoFactorEnrollmentState {
	readonly userId: string;
	readonly enabled: boolean;
	readonly secret: EncryptedTotpSecret | null;
	readonly lastTotpStep: number | null;
	readonly pendingSetup: PendingTwoFactorSetup | null;
	readonly activeBackupCodes: readonly ActiveBackupCode[];
	readonly tokenVersion: TokenVersion;
}

/** What one unit of work changed, in order; the repository applies each as its own conditional write. */
export type TwoFactorChange =
	| { readonly kind: "setup_started"; readonly setup: PendingTwoFactorSetup }
	| {
			readonly kind: "enabled";
			readonly secret: EncryptedTotpSecret;
			readonly lastTotpStep: number;
			readonly enrolledAt: EpochMs;
			readonly backupCodeHashes: readonly string[];
			readonly previousTokenVersion: TokenVersion;
	  }
	| { readonly kind: "cleared"; readonly clearedAt: EpochMs; readonly previousTokenVersion: TokenVersion }
	| { readonly kind: "backup_code_consumed"; readonly codeId: string; readonly consumedAt: EpochMs }
	| { readonly kind: "login_totp_accepted"; readonly timeStep: number; readonly assuredAt: EpochMs };

/**
 * The account's second factor: the pending setup, the enabled secret, the replay guard
 * (`lastTotpStep`) and the backup codes.
 *
 * Every write is conditional in storage: enabling compare-and-sets `two_factor_enabled = false` and
 * the loaded `tokenVersion` (bumped in the same transaction, D16); a consumed backup code requires
 * `used_at IS NULL` (D17); an accepted login code requires `last_totp_step IS NULL OR < step` (D13).
 */
export class TwoFactorEnrollment extends AggregateRoot<IdentityEvent> {
	private readonly changes: TwoFactorChange[] = [];

	private constructor(private state: TwoFactorEnrollmentState) {
		super();
	}

	/** Mapper-only. An enabled factor without a secret still loads (sign-in answers "not configured"); a pending setup without backup codes does not. */
	public static rehydrate(state: TwoFactorEnrollmentState): TwoFactorEnrollment {
		if (state.pendingSetup?.backupCodeHashes.length === 0) {
			throw new CorruptAggregateStateError("two_factor_enrollment", null, `pending setup of ${state.userId} has no backup codes`);
		}
		return new TwoFactorEnrollment(state);
	}

	public get userId(): string {
		return this.state.userId;
	}

	public get enabled(): boolean {
		return this.state.enabled;
	}

	public get lastTotpStep(): number | null {
		return this.state.lastTotpStep;
	}

	public get activeBackupCodes(): readonly ActiveBackupCode[] {
		return this.state.activeBackupCodes;
	}

	/** The writes this unit of work made, for the repository. */
	public get pendingChanges(): readonly TwoFactorChange[] {
		return this.changes;
	}

	/** Starts (or restarts) an enrollment. Refused once 2FA is enabled. */
	public startSetup(secret: EncryptedTotpSecret, backupCodeHashes: readonly string[], now: EpochMs): void {
		if (this.state.enabled) {
			throw new TwoFactorAlreadyEnabledError();
		}
		this.beginSetup(secret, backupCodeHashes, now);
	}

	/** The secret of a setup that can still be confirmed at `now`. */
	public pendingSecretAt(now: EpochMs): EncryptedTotpSecret {
		const pending: PendingTwoFactorSetup | null = this.state.pendingSetup;
		if (pending === null || pending.expiresAt < now) {
			throw new TwoFactorSetupExpiredError();
		}
		return pending.secret;
	}

	/**
	 * Confirms the pending setup with a valid code: 2FA on, the pending backup codes replace the old
	 * set, and the token generation moves (every older token is rejected, D16).
	 */
	public enable(verification: TotpVerification, secret: EncryptedTotpSecret, now: EpochMs): void {
		const pending: PendingTwoFactorSetup | null = this.state.pendingSetup;
		if (pending === null || pending.expiresAt < now) {
			throw new TwoFactorSetupExpiredError();
		}
		if (!verification.valid) {
			throw new InvalidTotpTokenError();
		}
		this.changes.push({
			kind: "enabled",
			secret,
			lastTotpStep: verification.timeStep,
			enrolledAt: now,
			backupCodeHashes: pending.backupCodeHashes,
			previousTokenVersion: this.state.tokenVersion,
		});
		this.state = {
			...this.state,
			enabled: true,
			secret,
			lastTotpStep: verification.timeStep,
			pendingSetup: null,
			activeBackupCodes: [],
			tokenVersion: this.state.tokenVersion.next(),
		};
		this.record(new UserCredentialsChanged(this.state.userId, "two_factor_enabled", now));
	}

	/** The enabled secret, for a rotation proof. */
	public enabledSecretForRotation(): EncryptedTotpSecret {
		if (!this.state.enabled) {
			throw new TwoFactorNotEnabledError();
		}
		return this.requireSecret();
	}

	/** The enabled secret, for completing a login. */
	public enabledSecretForLogin(): EncryptedTotpSecret {
		if (!this.state.enabled) {
			throw new TwoFactorNotEnabledForLoginError();
		}
		return this.requireSecret();
	}

	/**
	 * Re-enrolls: the password and a current second factor are proven, the old secret and backup
	 * codes are retired, the token generation moves (D16), and a new setup starts — one transaction.
	 * A backup-code proof consumes that code (D17).
	 */
	public rotate(
		passwordMatches: boolean,
		proof: RotationSecondFactor,
		newSetup: { readonly secret: EncryptedTotpSecret; readonly backupCodeHashes: readonly string[] },
		now: EpochMs,
	): void {
		if (!this.state.enabled) {
			throw new TwoFactorNotEnabledError();
		}
		if (!passwordMatches) {
			throw new InvalidRotationPasswordError();
		}
		if (proof.kind === "totp") {
			if (!proof.verification.valid) {
				throw new InvalidTotpTokenError();
			}
		} else {
			if (proof.matchedCodeId === null) {
				throw new BackupCodeRejectedError();
			}
			this.changes.push({ kind: "backup_code_consumed", codeId: proof.matchedCodeId, consumedAt: now });
		}
		this.changes.push({ kind: "cleared", clearedAt: now, previousTokenVersion: this.state.tokenVersion });
		this.state = {
			...this.state,
			enabled: false,
			secret: null,
			lastTotpStep: null,
			pendingSetup: null,
			activeBackupCodes: [],
			tokenVersion: this.state.tokenVersion.next(),
		};
		this.record(new UserCredentialsChanged(this.state.userId, "two_factor_rotated", now));
		this.beginSetup(newSetup.secret, newSetup.backupCodeHashes, now);
	}

	/** A login completed with this valid code: the step becomes the replay guard (stored conditionally, D13). */
	public acceptLoginCode(verification: TotpVerification, now: EpochMs): boolean {
		if (!verification.valid) {
			return false;
		}
		this.changes.push({ kind: "login_totp_accepted", timeStep: verification.timeStep, assuredAt: now });
		this.state = { ...this.state, lastTotpStep: verification.timeStep };
		return true;
	}

	/** A login completed with this backup code (consumed conditionally in storage). */
	public consumeBackupCodeForLogin(matchedCodeId: string | null, now: EpochMs): void {
		if (matchedCodeId === null) {
			throw new BackupCodeRejectedError();
		}
		this.changes.push({ kind: "backup_code_consumed", codeId: matchedCodeId, consumedAt: now });
		this.state = { ...this.state, activeBackupCodes: this.state.activeBackupCodes.filter((code: ActiveBackupCode): boolean => code.id !== matchedCodeId) };
	}

	private beginSetup(secret: EncryptedTotpSecret, backupCodeHashes: readonly string[], now: EpochMs): void {
		if (backupCodeHashes.length === 0) {
			throw new CorruptAggregateStateError("two_factor_enrollment", null, "a setup needs backup codes");
		}
		const setup: PendingTwoFactorSetup = { secret, backupCodeHashes, expiresAt: epochMs(now + TWO_FACTOR_SETUP_TTL_MS) };
		this.changes.push({ kind: "setup_started", setup });
		this.state = { ...this.state, pendingSetup: setup };
	}

	private requireSecret(): EncryptedTotpSecret {
		if (this.state.secret === null) {
			throw new TwoFactorNotConfiguredError();
		}
		return this.state.secret;
	}
}
