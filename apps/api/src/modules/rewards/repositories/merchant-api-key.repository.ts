import { Injectable } from "@nestjs/common";
import type { OrganizationApiKey, Prisma, PrismaClient } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

export type MerchantApiKeyDbClient = Pick<PrismaClient, "organizationApiKey">;

const API_KEY_LIST_INCLUDE = {
	location: { select: { name: true } },
} as const satisfies Prisma.OrganizationApiKeyInclude;

export type OrganizationApiKeyListRow = Prisma.OrganizationApiKeyGetPayload<{ include: typeof API_KEY_LIST_INCLUDE }>;

@Injectable()
export class MerchantApiKeyRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async listByOrgId(organizationId: string, locationId?: string, db: MerchantApiKeyDbClient = this.prisma): Promise<OrganizationApiKeyListRow[]> {
		return db.organizationApiKey.findMany({
			where: {
				organizationId,
				isDeleted: false,
				...(locationId !== undefined ? { locationId } : {}),
			},
			include: API_KEY_LIST_INCLUDE,
			orderBy: { createdAt: "desc" },
		});
	}

	public async create(
		input: {
			readonly organizationId: string;
			readonly locationId?: string;
			readonly name: string;
			readonly keyHash: string;
			readonly keyPrefix: string;
			readonly createdByUserId: string;
		},
		db: MerchantApiKeyDbClient = this.prisma,
	): Promise<OrganizationApiKey> {
		return db.organizationApiKey.create({
			data: {
				organizationId: input.organizationId,
				locationId: input.locationId ?? null,
				name: input.name,
				keyHash: input.keyHash,
				keyPrefix: input.keyPrefix,
				createdByUserId: input.createdByUserId,
			},
		});
	}

	public async findActiveByHash(keyHash: string): Promise<OrganizationApiKey | null> {
		return this.prisma.organizationApiKey.findFirst({
			where: {
				keyHash,
				isDeleted: false,
				revokedAt: null,
			},
		});
	}

	public async findActiveByIdAndOrg(keyId: string, organizationId: string, db: MerchantApiKeyDbClient = this.prisma): Promise<OrganizationApiKey | null> {
		return db.organizationApiKey.findFirst({
			where: { id: keyId, organizationId, isDeleted: false },
		});
	}

	public async touchLastUsed(keyId: string, lastUsedAt: number): Promise<void> {
		await this.prisma.organizationApiKey.update({
			where: { id: keyId },
			data: { lastUsedAt },
		});
	}

	public async revoke(keyId: string, revokedAt: number, db: MerchantApiKeyDbClient = this.prisma): Promise<void> {
		await db.organizationApiKey.update({
			where: { id: keyId },
			data: { revokedAt },
		});
	}
}
