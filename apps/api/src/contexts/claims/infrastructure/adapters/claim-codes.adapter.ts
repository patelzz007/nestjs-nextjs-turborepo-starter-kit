import { createHash, randomBytes, randomInt } from "node:crypto";

import { RewardBackupCodeSchema, type RewardBackupCode } from "@workspace/shared";

import type { RewardCodeHasher } from "../../../../platform/infrastructure/crypto/reward-code-hasher";
import { unambiguousCode } from "../../../../platform/infrastructure/crypto/unambiguous-code";
import type { ClaimCodesPort, IssuedClaimCodes, IssuedOtp } from "../../application/ports/claim-codes.port";

/** Bytes of entropy in a QR redemption token (base64url-encoded). */
const QR_TOKEN_BYTES = 32;
/** Backup codes avoid look-alike characters (no 0/O, 1/I). */
const BACKUP_CODE_LENGTH = 8;
const OTP_DIGITS = 6;
const OTP_UPPER_BOUND = 10 ** OTP_DIGITS;

function backupCode(): RewardBackupCode {
	return RewardBackupCodeSchema.parse(unambiguousCode(BACKUP_CODE_LENGTH));
}

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

/**
 * Claim codes: the QR token and backup code are random and stored only as keyed hashes (the key ring
 * rotates, so a lookup tries every key version); the claim OTP is a 6-digit code stored as SHA-256.
 */
export class ClaimCodesAdapter implements ClaimCodesPort {
	public constructor(private readonly hasher: RewardCodeHasher) {}

	public issueClaimCodes(): IssuedClaimCodes {
		const qrPayload: string = randomBytes(QR_TOKEN_BYTES).toString("base64url");
		const code: RewardBackupCode = backupCode();
		return { qrPayload, backupCode: code, hashes: { redemptionTokenHash: this.hasher.hash(qrPayload), backupCodeHash: this.hasher.hash(code) } };
	}

	public issueOtp(): IssuedOtp {
		const code: string = String(randomInt(0, OTP_UPPER_BOUND)).padStart(OTP_DIGITS, "0");
		return { code, codeHash: sha256Hex(code) };
	}

	public hashOtp(code: string): string {
		return sha256Hex(code);
	}

	public lookupCandidates(code: string): readonly string[] {
		return this.hasher.lookupCandidates(code);
	}
}
