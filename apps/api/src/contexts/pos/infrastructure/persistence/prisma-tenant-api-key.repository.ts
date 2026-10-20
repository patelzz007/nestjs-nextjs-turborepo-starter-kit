import type { TenantApiKey as TenantApiKeyRow, Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";

import { TenantApiKey, type NewApiKey } from "../../domain/aggregates/tenant-api-key.aggregate";
import type { TenantApiKeyRepository } from "../../domain/repositories/pos.repositories";

function toApiKey(row: TenantApiKeyRow): TenantApiKey {
	return TenantApiKey.rehydrate({
		id: row.id,
		tenantId: row.tenantId,
		locationId: row.locationId,
		revokedAt: row.revokedAt === null ? null : epochMs(Number(row.revokedAt)),
	});
}

/** Merchant API keys (`TenantApiKey`) on one unit-of-work transaction. */
export class PrismaTenantApiKeyRepository implements TenantApiKeyRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async add(key: NewApiKey): Promise<void> {
		await this.db.tenantApiKey.create({
			data: {
				id: key.id,
				tenantId: key.tenantId,
				locationId: key.locationId,
				name: key.name,
				keyHash: key.keyHash,
				keyPrefix: key.keyPrefix,
				scope: key.scope,
				createdByUserId: key.createdByUserId,
			},
			select: { id: true },
		});
	}

	public async findInTenant(id: string, tenantId: string): Promise<TenantApiKey | null> {
		const row = await this.db.tenantApiKey.findFirst({ where: { id, tenantId, isDeleted: false } });
		return row === null ? null : toApiKey(row);
	}

	public async findById(id: string): Promise<TenantApiKey | null> {
		const row = await this.db.tenantApiKey.findFirst({ where: { id, isDeleted: false } });
		return row === null ? null : toApiKey(row);
	}

	public async save(key: TenantApiKey): Promise<boolean> {
		const revokedAt = key.revokedInThisUnitOfWork;
		if (revokedAt === null) {
			return false;
		}
		const updated = await this.db.tenantApiKey.updateMany({ where: { id: key.id, revokedAt: null }, data: { revokedAt, updatedAt: revokedAt } });
		return updated.count === 1;
	}
}
