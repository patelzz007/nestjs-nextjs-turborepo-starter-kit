import { Injectable, NotFoundException } from "@nestjs/common";

import type { MerchantApiKeyCreated, MerchantApiKeyListQuery, MerchantApiKeySummary, MerchantCreateApiKeyInput } from "@workspace/shared";
import { EpochMsSchema } from "@workspace/shared";

import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
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
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
		private readonly tenantTx: TenantTransactionService,
	) {}

	public async listKeys(userId: string, orgSlug: string, query: MerchantApiKeyListQuery): Promise<MerchantApiKeySummary[]> {
		await this.merchantContext.requireUserCapability(userId, orgSlug, "merchant:manage_api_keys");
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);
		const locationId = query.locationId;
		if (locationId !== undefined) {
			await this.merchantContext.assertAccessibleLocationForUser(userId, orgSlug, locationId);
		}

		const rows = await this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId: resolved.organizationId,
				purpose: "merchant.api_keys.list",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => this.merchantApiKeyRepository.listByOrgId(resolved.organizationId, locationId, tx),
		);

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
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);
		if (input.locationId !== undefined) {
			await this.merchantContext.assertAccessibleLocationForUser(userId, orgSlug, input.locationId);
		}

		const plaintext = generateApiKeyPlaintext();
		const name = input.name ?? "API key";

		const created = await this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId: resolved.organizationId,
				purpose: "merchant.api_keys.create",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => {
				const row = await this.merchantApiKeyRepository.create(
					{
						organizationId: resolved.organizationId,
						locationId: input.locationId,
						name,
						keyHash: sha256Hex(plaintext),
						keyPrefix: plaintext.slice(0, 16),
						createdByUserId: userId,
					},
					tx,
				);

				await this.auditLogRepository.create(
					{
						organizationId: resolved.organizationId,
						action: "merchant.api_key_created",
						metadata: { keyId: row.id, name },
					},
					tx,
				);

				return row;
			},
		);

		return {
			id: created.id,
			apiKey: plaintext,
			name,
		};
	}

	public async revokeKey(userId: string, orgSlug: string, keyId: string): Promise<{ ok: true }> {
		await this.merchantContext.requireUserCapability(userId, orgSlug, "merchant:manage_api_keys");
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);

		await this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId: resolved.organizationId,
				purpose: "merchant.api_keys.revoke",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => {
				const key = await this.merchantApiKeyRepository.findActiveByIdAndOrg(keyId, resolved.organizationId, tx);

				if (key === null) {
					throw new NotFoundException({ message: "API key not found", error: "API_KEY_NOT_FOUND" });
				}

				const now = Date.now();
				await this.merchantApiKeyRepository.revoke(keyId, now, tx);

				await this.auditLogRepository.create(
					{
						organizationId: resolved.organizationId,
						action: "merchant.api_key_revoked",
						metadata: { keyId },
					},
					tx,
				);
			},
		);

		return { ok: true };
	}
}
