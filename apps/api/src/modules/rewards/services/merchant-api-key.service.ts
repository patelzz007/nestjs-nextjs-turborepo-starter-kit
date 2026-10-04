import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import type { MerchantApiKeyCreated, MerchantApiKeyListQuery, MerchantApiKeySummary, MerchantCreateApiKeyInput, PaginatedServiceResult } from "@workspace/shared";
import { EpochMsSchema } from "@workspace/shared";

import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { sha256Hex } from "../../../common/crypto/sha256";
import { generateApiKeyPlaintext } from "../utils/reward-crypto.util";
import { isLocationInScope } from "../utils/merchant-location-scope.util";
import { MerchantContextService } from "./merchant-context.service";

/** Characters of the plaintext key kept as its display prefix (the `key_prefix` column width). */
export const API_KEY_PREFIX_LENGTH = 16;

/** Display name of a key created without one. */
const DEFAULT_API_KEY_NAME = "API key";

@Injectable()
export class MerchantApiKeyService {
	public constructor(
		private readonly merchantApiKeyRepository: MerchantApiKeyRepository,
		private readonly auditLogRepository: RewardAuditLogRepository,
		private readonly merchantContext: MerchantContextService,
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
		private readonly tenantTx: TenantTransactionService,
	) {}

	public async listKeys(userId: string, orgSlug: string, query: MerchantApiKeyListQuery): Promise<PaginatedServiceResult<MerchantApiKeySummary>> {
		await this.merchantContext.requireUserCapability(userId, orgSlug, "merchant:manage_api_keys");
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);
		// A store-limited member lists only its stores' keys — never organization-wide ones.
		const scope = await this.merchantContext.resolveUserLocationScope(userId, orgSlug, query.locationId);

		const result = await this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId: resolved.organizationId,
				purpose: "merchant.api_keys.list",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => this.merchantApiKeyRepository.listByOrgId(resolved.organizationId, scope, query, tx),
		);

		return toPaginatedServiceResult(
			mapListResult(result, (row) => ({
				id: row.id,
				name: row.name,
				locationId: row.locationId,
				locationName: row.location?.name ?? null,
				scope: row.scope,
				revokedAt: row.revokedAt === null ? null : EpochMsSchema.parse(Number(row.revokedAt)),
				createdAt: EpochMsSchema.parse(Number(row.createdAt)),
				updatedAt: EpochMsSchema.parse(Number(row.updatedAt)),
				isDeleted: row.isDeleted,
				deletedAt: row.deletedAt === null ? null : EpochMsSchema.parse(Number(row.deletedAt)),
			})),
			query,
		);
	}

	public async createKey(userId: string, orgSlug: string, input: MerchantCreateApiKeyInput): Promise<MerchantApiKeyCreated> {
		await this.merchantContext.requireUserCapability(userId, orgSlug, "merchant:manage_api_keys");
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);
		const scope = await this.merchantContext.resolveUserLocationScope(userId, orgSlug, input.locationId);
		if (scope.kind === "SELECTED_LOCATIONS" && input.locationId === undefined) {
			// Only an all-stores member may mint a key that works at every store.
			throw new ForbiddenException({
				message: "Choose one of your stores — only members with access to every store can create an organization-wide key",
				error: "API_KEY_LOCATION_REQUIRED",
			});
		}

		const plaintext = generateApiKeyPlaintext();
		const name = input.name ?? DEFAULT_API_KEY_NAME;

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
						keyPrefix: plaintext.slice(0, API_KEY_PREFIX_LENGTH),
						scope: input.scope,
						createdByUserId: userId,
					},
					tx,
				);

				await this.auditLogRepository.create(
					{
						organizationId: resolved.organizationId,
						action: "merchant.api_key_created",
						actorUserId: userId,
						metadata: { keyId: row.id, name, scope: input.scope, locationId: input.locationId ?? null },
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
			scope: created.scope,
			locationId: created.locationId,
		};
	}

	public async revokeKey(userId: string, orgSlug: string, keyId: string): Promise<{ ok: true }> {
		await this.merchantContext.requireUserCapability(userId, orgSlug, "merchant:manage_api_keys");
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);
		const scope = await this.merchantContext.resolveUserLocationScope(userId, orgSlug, undefined);

		await this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId: resolved.organizationId,
				purpose: "merchant.api_keys.revoke",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => {
				const key = await this.merchantApiKeyRepository.findActiveByIdAndOrg(keyId, resolved.organizationId, tx);

				// Another store's key, or an organization-wide key, is outside a store-limited member's reach (uniform 404).
				if (key === null || !isLocationInScope(scope, key.locationId)) {
					throw new NotFoundException({ message: "API key not found", error: "API_KEY_NOT_FOUND" });
				}

				const now = Date.now();
				await this.merchantApiKeyRepository.revoke(keyId, now, tx);

				await this.auditLogRepository.create(
					{
						organizationId: resolved.organizationId,
						action: "merchant.api_key_revoked",
						actorUserId: userId,
						metadata: { keyId },
					},
					tx,
				);
			},
		);

		return { ok: true };
	}
}
