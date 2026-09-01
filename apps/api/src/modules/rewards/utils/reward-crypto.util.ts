import { createHash, randomBytes, randomInt } from "node:crypto";

import type { RewardBackupCode } from "@workspace/shared";
import { RewardBackupCodeSchema } from "@workspace/shared";

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

export function generateApiKeyPlaintext(): string {
	return `mk_live_${randomBytes(24).toString("base64url")}`;
}
