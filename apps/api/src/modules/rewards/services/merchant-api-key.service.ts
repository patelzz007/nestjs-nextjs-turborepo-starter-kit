import { Injectable, NotFoundException } from "@nestjs/common";

import type { MerchantApiKeyCreated, MerchantApiKeyListQuery, MerchantApiKeySummary, MerchantCreateApiKeyInput } from "@workspace/shared";
import { EpochMsSchema } from "@workspace/shared";

import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { generateApiKeyPlaintext, sha256Hex } from "../utils/reward-crypto.util";
import { MerchantContextService } from "./merchant-context.service";

@Injectable()
export class MerchantApiKeyService {
	public constructor(
		private readonly merchantApiKeyRepository: MerchantApiKeyRepository,
		private readonly auditLogRepository: RewardAuditLogRepository,
		private readonly merchantContext: MerchantContextService,
	) {}

	public async listKeys(userId: string, orgSlug: string, query: MerchantApiKeyListQuery): Promise<MerchantApiKeySummary[]> {
		await this.merchantContext.requireUserCapability(userId, orgSlug, "merchant:manage_api_keys");
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, orgSlug);
		const locationId = query.locationId;
		if (locationId !== undefined) {
			await this.merchantContext.assertAccessibleLocationForUser(userId, orgSlug, locationId);
		}

		const rows = await this.merchantApiKeyRepository.listByOrgId(orgId, locationId);

		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			locationId: row.locationId,
			locationName: row.location?.name ?? null,
			revokedAt: row.revokedAt === null ? null : EpochMsSchema.parse(Number(row.revokedAt)),
			createdAt: EpochMsSchema.parse(Number(row.createdAt)),
			updatedAt: EpochMsSchema.parse(Number(row.updatedAt)),
			isDeleted: row.isDeleted,
			deletedAt: row.deletedAt === null ? null : EpochMsSchema.parse(Number(row.deletedAt)),
		}));
	}

	public async createKey(userId: string, orgSlug: string, input: MerchantCreateApiKeyInput): Promise<MerchantApiKeyCreated> {
		await this.merchantContext.requireUserCapability(userId, orgSlug, "merchant:manage_api_keys");
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, orgSlug);
		if (input.locationId !== undefined) {
			await this.merchantContext.assertAccessibleLocationForUser(userId, orgSlug, input.locationId);
		}

		const plaintext = generateApiKeyPlaintext();
		const name = input.name ?? "API key";

		const created = await this.merchantApiKeyRepository.create({
			organizationId: orgId,
			locationId: input.locationId,
			name,
			keyHash: sha256Hex(plaintext),
			keyPrefix: plaintext.slice(0, 16),
			createdByUserId: userId,
		});

		await this.auditLogRepository.create({
			organizationId: orgId,
			action: "merchant.api_key_created",
			metadata: { keyId: created.id, name },
		});

		return {
			id: created.id,
			apiKey: plaintext,
			name,
		};
	}

	public async revokeKey(userId: string, orgSlug: string, keyId: string): Promise<{ ok: true }> {
		await this.merchantContext.requireUserCapability(userId, orgSlug, "merchant:manage_api_keys");
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, orgSlug);

		const key = await this.merchantApiKeyRepository.findActiveByIdAndOrg(keyId, orgId);

		if (key === null) {
			throw new NotFoundException({ message: "API key not found", error: "API_KEY_NOT_FOUND" });
		}

		const now = Date.now();
		await this.merchantApiKeyRepository.revoke(keyId, now);

		await this.auditLogRepository.create({
			organizationId: orgId,
			action: "merchant.api_key_revoked",
			metadata: { keyId },
		});

		return { ok: true };
	}
}
