import { PASSWORD_RESET_LINK_TTL_HOURS, epochMs, type EpochMs } from "@workspace/shared";

import { CorruptIdentityStateError, PasswordResetTokenInvalidError } from "../errors/identity.errors";

/** Milliseconds per hour — converts the shared reset-link lifetime (hours) to an expiry. */
const MS_PER_HOUR = 3_600_000;

/** How long a reset link works, in milliseconds (the shared link lifetime). */
export const PASSWORD_RESET_TOKEN_TTL_MS = PASSWORD_RESET_LINK_TTL_HOURS * MS_PER_HOUR;

/** Used tokens are retired seven days after use. */
const USED_TOKEN_RETENTION_DAYS = 7;
const MS_PER_DAY = 24 * MS_PER_HOUR;
export const USED_RESET_TOKEN_RETENTION_MS = USED_TOKEN_RETENTION_DAYS * MS_PER_DAY;

/** Expired tokens are retired one hour after expiry (buffer for in-flight requests). */
export const EXPIRED_RESET_TOKEN_GRACE_MS = MS_PER_HOUR;

export interface PasswordResetTokenState {
	readonly id: string;
	readonly userId: string;
	/** bcrypt hash of the raw token (the link carries the raw token). */
	readonly tokenHash: string;
	/** SHA-256 digest of the raw token, for the indexed lookup. */
	readonly tokenDigest: string;
	readonly expiresAt: EpochMs;
	readonly usedAt: EpochMs | null;
}

/**
 * A one-time password reset link of an account (an entity of the account's credential lifecycle).
 * Consuming it is a compare-and-set on `usedAt IS NULL` in storage (D12): two resets presenting the
 * same token cannot both succeed.
 */
export class PasswordResetToken {
	private constructor(private state: PasswordResetTokenState) {}

	/** A fresh token for `userId`, valid for {@link PASSWORD_RESET_TOKEN_TTL_MS}. */
	public static issue(input: { readonly id: string; readonly userId: string; readonly tokenHash: string; readonly tokenDigest: string }, now: EpochMs): PasswordResetToken {
		return new PasswordResetToken({ ...input, expiresAt: epochMs(now + PASSWORD_RESET_TOKEN_TTL_MS), usedAt: null });
	}

	public static rehydrate(state: PasswordResetTokenState): PasswordResetToken {
		if (state.tokenHash.length === 0 || state.tokenDigest.length === 0) {
			throw new CorruptIdentityStateError("password_reset_token", `token ${state.id} has no hash`);
		}
		return new PasswordResetToken(state);
	}

	public get id(): string {
		return this.state.id;
	}

	public get userId(): string {
		return this.state.userId;
	}

	public get snapshot(): PasswordResetTokenState {
		return this.state;
	}

	/** Usable: never used and not expired at `now` (the expiry instant itself still works). */
	public isUsableAt(now: EpochMs): boolean {
		return this.state.usedAt === null && this.state.expiresAt >= now;
	}

	/** Marks the token used. Storage re-checks `usedAt IS NULL` when it writes this. */
	public consume(now: EpochMs): void {
		if (!this.isUsableAt(now)) {
			throw new PasswordResetTokenInvalidError();
		}
		this.state = { ...this.state, usedAt: now };
	}
}
