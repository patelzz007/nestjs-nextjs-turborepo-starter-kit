import { Injectable } from "@nestjs/common";

import { MerchantApiKeyRepository } from "../../rewards/repositories/merchant-api-key.repository";
import { sha256Hex } from "../../rewards/utils/reward-crypto.util";
import { MERCHANT_API_KEY_CAPABILITIES } from "../constants/merchant-api-key-capabilities";
import type { MerchantApiKeyAuthContext } from "../types/api-key-auth.types";

@Injectable()
export class MerchantApiKeyVerificationService {
	public constructor(private readonly merchantApiKeyRepository: MerchantApiKeyRepository) {}

	public async verify(plaintext: string): Promise<MerchantApiKeyAuthContext | null> {
		const keyHash = sha256Hex(plaintext);
		const keyRecord = await this.merchantApiKeyRepository.findActiveByHash(keyHash);

		if (keyRecord === null) {
			return null;
		}

		await this.merchantApiKeyRepository.touchLastUsed(keyRecord.id, Date.now());

		return {
			provider: "merchant",
			apiKeyId: keyRecord.id,
			merchantOrgId: keyRecord.merchantOrgId,
			capabilities: MERCHANT_API_KEY_CAPABILITIES,
		};
	}
}
