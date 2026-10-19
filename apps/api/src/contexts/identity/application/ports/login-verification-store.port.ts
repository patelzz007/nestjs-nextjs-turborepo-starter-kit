import type { PendingSignInMethod } from "../services/pending-sign-in";

/** One pending new-device verification (stored as JSON; validated on read). */
export interface LoginVerificationRecord {
	readonly userId: string;
	readonly codeHash: string;
	readonly clientType: string | null;
	readonly deviceInfo: string | null;
	readonly ipAddress: string | null;
	readonly signInMethod: PendingSignInMethod;
}

/**
 * Short-lived state of the new-device login verification (Redis; in-memory when Redis is not
 * ready). The attempt counter is atomic (D20): `INCR` + `PEXPIRE` in one `MULTI`, or one synchronous
 * update of the in-memory map.
 */
export interface LoginVerificationStorePort {
	saveChallenge(verificationId: string, record: LoginVerificationRecord, ttlMs: number): Promise<void>;
	/** The record, `null` when absent or expired, or `"corrupt"` when the stored value fails validation. */
	findChallenge(verificationId: string): Promise<LoginVerificationRecord | null | "corrupt">;
	deleteChallenge(verificationId: string): Promise<void>;
	/** Counts one attempt and returns the new count; the counter expires with the challenge. */
	incrementAttempts(verificationId: string, ttlMs: number): Promise<number>;
	markDeviceRecognized(userId: string, deviceKey: string, ttlMs: number): Promise<void>;
	isDeviceRecognized(userId: string, deviceKey: string): Promise<boolean>;
	markRecentlyVerified(userId: string, verifiedAt: number, ttlMs: number): Promise<void>;
	wasRecentlyVerified(userId: string): Promise<boolean>;
}
