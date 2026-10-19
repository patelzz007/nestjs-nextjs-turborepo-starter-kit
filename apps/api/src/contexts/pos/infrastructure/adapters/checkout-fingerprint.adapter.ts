import { Injectable } from "@nestjs/common";
import type { RedemptionCheckoutInput } from "@workspace/shared";

import { sha256Hex } from "../../../../platform/infrastructure/crypto/sha256";
import type { CheckoutFingerprintPort } from "../../application/ports/checkout-fingerprint.port";

/** sha256 of the canonical bill and codes, byte-identical to what the stored sales were hashed with. */
@Injectable()
export class Sha256CheckoutFingerprint implements CheckoutFingerprintPort {
	public of(input: RedemptionCheckoutInput): string {
		const canonical = JSON.stringify({
			billTotalMinor: input.billTotalMinor,
			currency: input.currency,
			codes: input.codes.map((code) => ({ token: code.token ?? null, backupCode: code.backupCode ?? null })),
		});
		return sha256Hex(canonical);
	}
}
