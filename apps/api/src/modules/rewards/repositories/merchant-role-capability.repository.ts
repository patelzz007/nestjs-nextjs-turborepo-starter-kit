import { Injectable } from "@nestjs/common";
import type { MerchantMemberRole } from "@prisma/client";

import type { CapabilitySlug } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class MerchantRoleCapabilityRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async countActive(): Promise<number> {
		return this.prisma.merchantRoleCapability.count({
			where: { isDeleted: false },
		});
	}

	public async listActiveWithSlugs(): Promise<
		{
			readonly role: MerchantMemberRole;
			readonly capability: { readonly slug: string };
		}[]
	> {
		return this.prisma.merchantRoleCapability.findMany({
			where: { isDeleted: false },
			select: {
				role: true,
				capability: { select: { slug: true } },
			},
			orderBy: [{ role: "asc" }, { capability: { slug: "asc" } }],
		});
	}

	public async findCapabilityIdsBySlugs(slugs: readonly CapabilitySlug[]): Promise<{ readonly id: string; readonly slug: string }[]> {
		if (slugs.length === 0) {
			return [];
		}
		return this.prisma.capabilityDefinition.findMany({
			where: {
				isDeleted: false,
				scope: "MERCHANT",
				slug: { in: [...slugs] },
			},
			select: { id: true, slug: true },
		});
	}

	public async syncRoleCapabilities(role: MerchantMemberRole, desiredCapabilityIds: ReadonlySet<string>, now: number): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const existing = await tx.merchantRoleCapability.findMany({
				where: { role },
				select: { id: true, capabilityId: true, isDeleted: true },
			});

			for (const row of existing) {
				if (!desiredCapabilityIds.has(row.capabilityId) && !row.isDeleted) {
					await tx.merchantRoleCapability.update({
						where: { id: row.id },
						data: { isDeleted: true, deletedAt: now, updatedAt: now },
					});
				}
			}

			for (const capabilityId of desiredCapabilityIds) {
				await tx.merchantRoleCapability.upsert({
					where: {
						role_capabilityId: {
							role,
							capabilityId,
						},
					},
					create: {
						role,
						capabilityId,
					},
					update: {
						isDeleted: false,
						deletedAt: null,
						updatedAt: now,
					},
				});
			}
		});
	}
}
