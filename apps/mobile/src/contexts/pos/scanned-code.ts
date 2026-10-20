// What a QR code read at the till is: a customer's redemption QR (its
// `qrPayload` is the claim's redemption token, sent as-is), the merchant
// console's pairing QR (`pos-pair:v1:<code>`), or neither. The API is the
// authority on whether a token is real; this only routes the text.

import { PosPairingQrPayloadSchema, RedemptionCodeSchema, type PosPairingCode, type RedemptionCode } from "@workspace/shared";

/** Typed pairing and backup codes are 8 characters (`RewardBackupCodeSchema`). */
export const TILL_CODE_LENGTH = 8;

export type ScannedCode =
	{ readonly kind: "redemption"; readonly code: RedemptionCode } | { readonly kind: "pairing"; readonly pairingCode: PosPairingCode } | { readonly kind: "unrecognised" };

export function classifyScannedCode(text: string): ScannedCode {
	const pairing = PosPairingQrPayloadSchema.safeParse(text);
	if (pairing.success) {
		return { kind: "pairing", pairingCode: pairing.data };
	}
	const redemption = RedemptionCodeSchema.safeParse({ token: text.trim() });
	return redemption.success ? { kind: "redemption", code: redemption.data } : { kind: "unrecognised" };
}
