import { Injectable } from "@nestjs/common";
import type { OrganizationInvitation } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class OrganizationInviteRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async createOnboardingInvite(input: {
		readonly email: string;
		readonly tokenHash: string;
		readonly organizationId: string;
		readonly createdByAdminId: string;
		readonly expiresAt: number;
	}): Promise<OrganizationInvitation> {
		return this.prisma.organizationInvitation.create({
			data: {
				organizationId: input.organizationId,
				email: input.email,
				tokenHash: input.tokenHash,
				intendedRole: "OWNER",
				status: "PENDING",
				createdByAdminId: input.createdByAdminId,
				expiresAt: BigInt(input.expiresAt),
			},
		});
	}

	public async findByTokenHash(tokenHash: string): Promise<
		| (OrganizationInvitation & {
				organization: {
					id: string;
					slug: string;
					displayName: string;
					merchantProfile: { city: string } | null;
				} | null;
		  })
		| null
	> {
		return this.prisma.organizationInvitation.findFirst({
			where: { tokenHash, status: "PENDING" },
			include: {
				organization: {
					select: {
						id: true,
						slug: true,
						displayName: true,
						merchantProfile: { select: { city: true } },
					},
				},
			},
		});
	}

	public async markAccepted(inviteId: string, userId: string, acceptedAt: number): Promise<void> {
		await this.prisma.organizationInvitation.update({
			where: { id: inviteId },
			data: {
				status: "ACCEPTED",
				acceptedByUserId: userId,
				acceptedAt: BigInt(acceptedAt),
				updatedAt: BigInt(acceptedAt),
			},
		});
	}
}
