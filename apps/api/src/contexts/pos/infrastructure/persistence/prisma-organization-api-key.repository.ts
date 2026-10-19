import type { OrganizationApiKey as OrganizationApiKeyRow, Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";

import { OrganizationApiKey, type NewApiKey } from "../../domain/aggregates/organization-api-key.aggregate";
import type { OrganizationApiKeyRepository } from "../../domain/repositories/pos.repositories";

function toApiKey(row: OrganizationApiKeyRow): OrganizationApiKey {
	return OrganizationApiKey.rehydrate({
		id: row.id,
		organizationId: row.organizationId,
		locationId: row.locationId,
		revokedAt: row.revokedAt === null ? null : epochMs(Number(row.revokedAt)),
	});
}

/** Merchant API keys (`OrganizationApiKey`) on one unit-of-work transaction. */
export class PrismaOrganizationApiKeyRepository implements OrganizationApiKeyRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async add(key: NewApiKey): Promise<void> {
		await this.db.organizationApiKey.create({
			data: {
				id: key.id,
				organizationId: key.organizationId,
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

	public async findInOrganization(id: string, organizationId: string): Promise<OrganizationApiKey | null> {
		const row = await this.db.organizationApiKey.findFirst({ where: { id, organizationId, isDeleted: false } });
		return row === null ? null : toApiKey(row);
	}

	public async findById(id: string): Promise<OrganizationApiKey | null> {
		const row = await this.db.organizationApiKey.findFirst({ where: { id, isDeleted: false } });
		return row === null ? null : toApiKey(row);
	}

	public async save(key: OrganizationApiKey): Promise<boolean> {
		const revokedAt = key.revokedInThisUnitOfWork;
		if (revokedAt === null) {
			return false;
		}
		const updated = await this.db.organizationApiKey.updateMany({ where: { id: key.id, revokedAt: null }, data: { revokedAt, updatedAt: revokedAt } });
		return updated.count === 1;
	}
}
