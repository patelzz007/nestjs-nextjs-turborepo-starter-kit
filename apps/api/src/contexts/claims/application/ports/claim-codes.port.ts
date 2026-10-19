import type { RewardBackupCode } from "@workspace/shared";

import type { ClaimCodeHashes } from "../../domain/aggregates/reward-claim.aggregate";

/** A freshly generated pair of claim codes: plaintexts for the customer once, hashes for storage. */
export interface IssuedClaimCodes {
	readonly qrPayload: string;
	readonly backupCode: RewardBackupCode;
	readonly hashes: ClaimCodeHashes;
}

/** A freshly generated claim OTP: the code for the email, its hash for storage. */
export interface IssuedOtp {
	readonly code: string;
	readonly codeHash: string;
}

/** Generates and hashes claim codes and OTPs (secrets never reach the domain or the database in plaintext). */
export interface ClaimCodesPort {
	issueClaimCodes(): IssuedClaimCodes;
	issueOtp(): IssuedOtp;
	hashOtp(code: string): string;
	/** Every hash a presented code may be stored under (one per key version of the hasher). */
	lookupCandidates(code: string): readonly string[];
}
