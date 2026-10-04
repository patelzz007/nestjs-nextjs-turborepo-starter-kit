import { Injectable } from "@nestjs/common";

import { assertOrganizationOperating } from "../../rewards/policies/organization-operating-status.policy";
import { MerchantApiKeyRepository } from "../../rewards/repositories/merchant-api-key.repository";
import { sha256Hex } from "../../../common/crypto/sha256";
import { MERCHANT_API_KEY_SCOPE_CAPABILITIES } from "../constants/merchant-api-key-capabilities";
import type { MerchantApiKeyAuthContext } from "../types/api-key-auth.types";

@Injectable()
export class MerchantApiKeyVerificationService {
	public constructor(private readonly merchantApiKeyRepository: MerchantApiKeyRepository) {}

	public async verify(plaintext: string): Promise<MerchantApiKeyAuthContext | null> {
		const keyHash = sha256Hex(plaintext);
		const keyRecord = await this.merchantApiKeyRepository.findActiveByHash(keyHash);

		// A key paired to a terminal dies with it: once the till is removed the key must not keep working as a manual key.
		if (keyRecord === null || keyRecord.terminal?.isDeleted === true) {
			return null;
		}
		// A valid key of a suspended / deactivated merchant authenticates, but may do nothing: one 403 for every path.
		assertOrganizationOperating(keyRecord.organization);

		await this.merchantApiKeyRepository.touchLastUsed(keyRecord.id, Date.now());

		return {
			provider: "merchant",
			apiKeyId: keyRecord.id,
			organizationId: keyRecord.organizationId,
			locationId: keyRecord.locationId,
			terminal: keyRecord.terminal === null ? null : { id: keyRecord.terminal.id, terminalId: keyRecord.terminal.terminalId, locationId: keyRecord.terminal.locationId },
			requireRegisteredTerminals: keyRecord.organization.merchantProfile?.requireRegisteredTerminals ?? false,
			scope: keyRecord.scope,
			capabilities: MERCHANT_API_KEY_SCOPE_CAPABILITIES[keyRecord.scope],
		};
	}
}
