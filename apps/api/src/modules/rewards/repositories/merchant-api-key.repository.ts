import { Injectable } from "@nestjs/common";
import type { MerchantApiKey } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class MerchantApiKeyRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async listByOrgId(merchantOrgId: string): Promise<MerchantApiKey[]> {
		return this.prisma.merchantApiKey.findMany({
			where: { merchantOrgId, isDeleted: false },
			orderBy: { createdAt: "desc" },
		});
	}

	public async create(input: {
		readonly merchantOrgId: string;
		readonly name: string;
		readonly keyHash: string;
		readonly keyPrefix: string;
		readonly createdByUserId: string;
	}): Promise<MerchantApiKey> {
		return this.prisma.merchantApiKey.create({
			data: {
				merchantOrgId: input.merchantOrgId,
				name: input.name,
				keyHash: input.keyHash,
				keyPrefix: input.keyPrefix,
				createdByUserId: input.createdByUserId,
			},
		});
	}

	public async findActiveByIdAndOrg(keyId: string, merchantOrgId: string): Promise<MerchantApiKey | null> {
		return this.prisma.merchantApiKey.findFirst({
			where: { id: keyId, merchantOrgId, isDeleted: false },
		});
	}

	public async revoke(keyId: string, revokedAt: number): Promise<void> {
		await this.prisma.merchantApiKey.update({
			where: { id: keyId },
			data: { revokedAt },
		});
	}
}
