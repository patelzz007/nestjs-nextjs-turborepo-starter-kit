import { Injectable } from "@nestjs/common";
import type { MerchantOrg, Prisma } from "@prisma/client";

import type { AdminMerchantListQuery } from "@workspace/shared";

import { fetchStringIdListPage } from "../../../platform/persistence/cursor-list";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

const ADMIN_MERCHANT_LIST_INCLUDE = {
	members: {
		where: { role: "OWNER", isDeleted: false },
		select: { userId: true },
		take: 1,
	},
} as const satisfies Prisma.MerchantOrgInclude;

const ADMIN_MERCHANT_DETAIL_INCLUDE = {
	members: {
		where: { isDeleted: false },
		select: {
			role: true,
			userId: true,
			user: {
				select: {
					email: true,
					fullName: true,
				},
			},
		},
	},
	_count: {
		select: {
			members: {
				where: { isDeleted: false },
			},
		},
	},
} as const satisfies Prisma.MerchantOrgInclude;

export type MerchantOrgAdminListRow = Prisma.MerchantOrgGetPayload<{ include: typeof ADMIN_MERCHANT_LIST_INCLUDE }>;
export type MerchantOrgAdminDetailRow = Prisma.MerchantOrgGetPayload<{ include: typeof ADMIN_MERCHANT_DETAIL_INCLUDE }>;

@Injectable()
export class MerchantOrgRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findActiveById(merchantOrgId: string): Promise<Pick<MerchantOrg, "id"> | null> {
		return this.prisma.merchantOrg.findFirst({
			where: { id: merchantOrgId, isDeleted: false },
			select: { id: true },
		});
	}

	public async findById(merchantOrgId: string): Promise<MerchantOrg | null> {
		return this.prisma.merchantOrg.findFirst({
			where: { id: merchantOrgId, isDeleted: false },
		});
	}

	public async findForAdminDetail(merchantOrgId: string): Promise<MerchantOrgAdminDetailRow | null> {
		return this.prisma.merchantOrg.findFirst({
			where: { id: merchantOrgId, isDeleted: false },
			include: ADMIN_MERCHANT_DETAIL_INCLUDE,
		});
	}

	public async listActiveSummaries(limit: number): Promise<Pick<MerchantOrg, "id" | "businessName" | "city" | "kybStatus" | "status">[]> {
		return this.prisma.merchantOrg.findMany({
			where: { isDeleted: false },
			orderBy: { businessName: "asc" },
			take: limit,
			select: {
				id: true,
				businessName: true,
				city: true,
				kybStatus: true,
				status: true,
			},
		});
	}

	public async listForAdmin(query: AdminMerchantListQuery): Promise<RepositoryListResult<MerchantOrgAdminListRow>> {
		const search = query.search?.trim();
		const where: Prisma.MerchantOrgWhereInput = {
			isDeleted: false,
			...(query.city !== undefined ? { city: query.city } : {}),
			...(query.kybStatus !== undefined ? { kybStatus: query.kybStatus } : {}),
			...(query.status !== undefined ? { status: query.status } : {}),
			...(search !== undefined && search.length > 0
				? {
						OR: [
							{ businessName: { contains: search, mode: "insensitive" } },
							{ legalName: { contains: search, mode: "insensitive" } },
							{ contactEmail: { contains: search, mode: "insensitive" } },
						],
					}
				: {}),
		};

		return fetchStringIdListPage(query, {
			where,
			mergeCursor: (baseWhere, cursorId) => ({ ...baseWhere, id: { gt: cursorId } }),
			readId: (row) => row.id,
			findMany: (args): Promise<MerchantOrgAdminListRow[]> =>
				this.prisma.merchantOrg.findMany({
					...args,
					include: ADMIN_MERCHANT_LIST_INCLUDE,
				}),
			count: (listWhere) => this.prisma.merchantOrg.count({ where: listWhere }),
		});
	}

	public async updateKyb(merchantOrgId: string, data: { readonly kybStatus: MerchantOrg["kybStatus"]; readonly kybFields?: Prisma.InputJsonValue }): Promise<void> {
		await this.prisma.merchantOrg.update({
			where: { id: merchantOrgId },
			data: {
				kybStatus: data.kybStatus,
				...(data.kybFields !== undefined ? { kybFields: data.kybFields } : {}),
				...(data.kybStatus === "APPROVED" ? { status: "ACTIVE" } : {}),
			},
		});
	}

	public async updateMerchantKybSubmission(
		merchantOrgId: string,
		data: {
			readonly businessName: string;
			readonly legalName: string;
			readonly addressText: string;
			readonly contactPhone: string;
			readonly kybFields: Prisma.InputJsonValue;
			readonly kybStatus: MerchantOrg["kybStatus"];
		},
	): Promise<MerchantOrg> {
		return this.prisma.merchantOrg.update({
			where: { id: merchantOrgId },
			data: {
				businessName: data.businessName,
				legalName: data.legalName,
				addressText: data.addressText,
				contactPhone: data.contactPhone,
				kybFields: data.kybFields,
				kybStatus: data.kybStatus,
			},
		});
	}

	public async createWithOwner(input: {
		readonly businessName: string;
		readonly city: "KUALA_LUMPUR" | "MELAKA";
		readonly contactEmail: string;
		readonly userId: string;
		readonly legalName: string;
		readonly addressText: string;
		readonly contactPhone: string;
		readonly kybFields: Prisma.InputJsonValue;
	}): Promise<MerchantOrg> {
		return this.prisma.$transaction(async (tx) => {
			const org = await tx.merchantOrg.create({
				data: {
					businessName: input.businessName,
					legalName: input.legalName,
					addressText: input.addressText,
					contactPhone: input.contactPhone,
					kybFields: input.kybFields,
					kybStatus: "PENDING",
					category: "general",
					city: input.city,
					status: "ONBOARDING",
					contactEmail: input.contactEmail,
				},
			});

			await tx.merchantMember.create({
				data: {
					userId: input.userId,
					merchantOrgId: org.id,
					role: "OWNER",
				},
			});

			return org;
		});
	}
}
