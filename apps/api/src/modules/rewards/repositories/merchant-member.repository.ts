import { Injectable } from "@nestjs/common";
import type { MerchantMember, MerchantMemberRole, MerchantOrg, Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class MerchantMemberRepository {
	public constructor(private readonly prisma: PrismaService) {}

	private static readonly membershipOrgSelect = {
		merchantOrgId: true,
		role: true,
	} as const satisfies Prisma.MerchantMemberSelect;

	private static readonly membershipRoleSelect = {
		role: true,
	} as const satisfies Prisma.MerchantMemberSelect;

	private static readonly membershipWithOrgInclude = {
		merchantOrg: {
			select: {
				id: true,
				businessName: true,
				city: true,
				kybStatus: true,
				status: true,
				isDeleted: true,
			},
		},
	} as const satisfies Prisma.MerchantMemberInclude;

	public async listOrgRefsForUser(userId: string): Promise<Pick<MerchantMember, "merchantOrgId" | "role">[]> {
		return this.prisma.merchantMember.findMany({
			where: { userId, isDeleted: false },
			select: MerchantMemberRepository.membershipOrgSelect,
		});
	}

	public async findRoleForUserInOrg(userId: string, merchantOrgId: string): Promise<Pick<MerchantMember, "role"> | null> {
		return this.prisma.merchantMember.findFirst({
			where: { userId, merchantOrgId, isDeleted: false },
			select: MerchantMemberRepository.membershipRoleSelect,
		});
	}

	public async listWithOrgForUser(userId: string): Promise<
		(MerchantMember & {
			merchantOrg: Pick<MerchantOrg, "id" | "businessName" | "city" | "kybStatus" | "status" | "isDeleted">;
		})[]
	> {
		return this.prisma.merchantMember.findMany({
			where: { userId, isDeleted: false },
			include: MerchantMemberRepository.membershipWithOrgInclude,
			orderBy: { createdAt: "asc" },
		});
	}

	public async findActiveMembership(userId: string, merchantOrgId: string): Promise<Pick<MerchantMember, "id" | "role"> | null> {
		return this.prisma.merchantMember.findFirst({
			where: { userId, merchantOrgId, isDeleted: false },
			select: { id: true, role: true },
		});
	}

	public async findMembershipForOnboarding(
		userId: string,
		businessName: string,
		city: "KUALA_LUMPUR" | "MELAKA",
	): Promise<Pick<MerchantMember, "merchantOrgId" | "role"> | null> {
		return this.prisma.merchantMember.findFirst({
			where: { userId, isDeleted: false, merchantOrg: { businessName, city, isDeleted: false } },
			select: { merchantOrgId: true, role: true },
		});
	}

	public async create(input: { readonly userId: string; readonly merchantOrgId: string; readonly role: MerchantMemberRole }): Promise<void> {
		await this.prisma.merchantMember.create({
			data: {
				userId: input.userId,
				merchantOrgId: input.merchantOrgId,
				role: input.role,
			},
		});
	}

	public async listOwnersByOrgId(merchantOrgId: string): Promise<MerchantMember[]> {
		return this.prisma.merchantMember.findMany({
			where: { merchantOrgId, role: "OWNER", isDeleted: false },
		});
	}
}
