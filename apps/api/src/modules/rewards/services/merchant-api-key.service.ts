import { Injectable, NotFoundException } from "@nestjs/common";

import type { MerchantApiKeyCreated, MerchantApiKeySummary, MerchantCreateApiKeyInput } from "@workspace/shared";
import { EpochMsSchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { generateApiKeyPlaintext, sha256Hex } from "../utils/reward-crypto.util";
import { MerchantContextService } from "./merchant-context.service";

@Injectable()
export class MerchantApiKeyService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly merchantContext: MerchantContextService,
	) {}

	public async listKeys(userId: string, merchantOrgId: string | undefined): Promise<MerchantApiKeySummary[]> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		await this.merchantContext.requireCapability(userId, orgId, "merchant:manage_api_keys");

		const rows = await this.prisma.merchantApiKey.findMany({
			where: { merchantOrgId: orgId, isDeleted: false },
			orderBy: { createdAt: "desc" },
		});

		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			revokedAt: row.revokedAt === null ? null : EpochMsSchema.parse(Number(row.revokedAt)),
			createdAt: EpochMsSchema.parse(Number(row.createdAt)),
			updatedAt: EpochMsSchema.parse(Number(row.updatedAt)),
			isDeleted: row.isDeleted,
			deletedAt: row.deletedAt === null ? null : EpochMsSchema.parse(Number(row.deletedAt)),
		}));
	}

	public async createKey(userId: string, merchantOrgId: string | undefined, input: MerchantCreateApiKeyInput): Promise<MerchantApiKeyCreated> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		await this.merchantContext.requireCapability(userId, orgId, "merchant:manage_api_keys");

		const plaintext = generateApiKeyPlaintext();
		const name = input.name ?? "POS API key";

		const created = await this.prisma.merchantApiKey.create({
			data: {
				merchantOrgId: orgId,
				name,
				keyHash: sha256Hex(plaintext),
				keyPrefix: plaintext.slice(0, 16),
				createdByUserId: userId,
			},
		});

		await this.prisma.rewardAuditLog.create({
			data: {
				merchantOrgId: orgId,
				action: "merchant.api_key_created",
				metadata: { keyId: created.id, name },
			},
		});

		return {
			id: created.id,
			apiKey: plaintext,
			name,
		};
	}

	public async revokeKey(userId: string, merchantOrgId: string | undefined, keyId: string): Promise<{ ok: true }> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(userId, merchantOrgId);
		await this.merchantContext.requireCapability(userId, orgId, "merchant:manage_api_keys");

		const key = await this.prisma.merchantApiKey.findFirst({
			where: { id: keyId, merchantOrgId: orgId, isDeleted: false },
		});

		if (key === null) {
			throw new NotFoundException({ message: "API key not found", error: "API_KEY_NOT_FOUND" });
		}

		const now = Date.now();
		await this.prisma.merchantApiKey.update({
			where: { id: keyId },
			data: { revokedAt: now },
		});

		await this.prisma.rewardAuditLog.create({
			data: {
				merchantOrgId: orgId,
				action: "merchant.api_key_revoked",
				metadata: { keyId },
			},
		});

		return { ok: true };
	}
}
