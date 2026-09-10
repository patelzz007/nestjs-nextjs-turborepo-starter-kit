import { createHash, randomBytes, randomInt } from "node:crypto";

import type { RewardBackupCode } from "@workspace/shared";
import { RewardBackupCodeSchema } from "@workspace/shared";

import { opensslRandBase64OneLine } from "../../../common/crypto/openssl-rand-base64";

const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

export function generateOpaqueToken(): string {
	return randomBytes(32).toString("base64url");
}

export function generateBackupCode(): RewardBackupCode {
	let code = "";
	for (let index = 0; index < 8; index += 1) {
		code += BACKUP_ALPHABET[randomInt(0, BACKUP_ALPHABET.length)];
	}
	return RewardBackupCodeSchema.parse(code);
}

export function generateOtpCode(): string {
	return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Merchant POS / M2M API key — suffix is `openssl rand -base64 128` (single line). */
export function generateApiKeyPlaintext(): string {
	return `mk_live_${opensslRandBase64OneLine()}`;
}
