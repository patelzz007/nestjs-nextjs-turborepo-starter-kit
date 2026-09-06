import { Injectable } from "@nestjs/common";
import type { MerchantInvite } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

const INVITE_PREVIEW_SELECT = {
	id: true,
	email: true,
	businessName: true,
	city: true,
	expiresAt: true,
	acceptedAt: true,
	merchantOrgId: true,
} as const;

export interface MerchantInvitePreview {
	readonly id: string;
	readonly email: string;
	readonly businessName: string;
	readonly city: "KUALA_LUMPUR" | "MELAKA";
	readonly expiresAt: bigint;
	readonly acceptedAt: bigint | null;
	readonly merchantOrgId: string | null;
}

@Injectable()
export class MerchantInviteRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async create(input: {
		readonly email: string;
		readonly tokenHash: string;
		readonly businessName: string;
		readonly city: "KUALA_LUMPUR" | "MELAKA";
		readonly createdByAdminId: string;
		readonly expiresAt: number;
	}): Promise<MerchantInvite> {
		return this.prisma.merchantInvite.create({
			data: {
				email: input.email,
				tokenHash: input.tokenHash,
				businessName: input.businessName,
				city: input.city,
				createdByAdminId: input.createdByAdminId,
				expiresAt: input.expiresAt,
			},
		});
	}

	public async findByTokenHash(tokenHash: string): Promise<MerchantInvitePreview | null> {
		return this.prisma.merchantInvite.findFirst({
			where: { tokenHash, isDeleted: false },
			select: INVITE_PREVIEW_SELECT,
		});
	}

	public async markAccepted(inviteId: string, userId: string, merchantOrgId: string, acceptedAt: number): Promise<void> {
		await this.prisma.merchantInvite.update({
			where: { id: inviteId },
			data: {
				acceptedAt,
				acceptedByUserId: userId,
				merchantOrgId,
				updatedAt: acceptedAt,
			},
		});
	}
}
