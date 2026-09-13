import { Injectable } from "@nestjs/common";
import type { Organization, OrganizationMerchantProfile, Prisma } from "@prisma/client";

import type { AdminMerchantListQuery } from "@workspace/shared";

import { fetchStringIdListPage } from "../../../platform/persistence/cursor-list";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

const ADMIN_ORG_LIST_INCLUDE = {
	merchantProfile: true,
	memberships: {
		where: { role: "OWNER", status: "ACTIVE", isDeleted: false },
		include: { user: { select: { id: true } } },
		take: 1,
	},
} as const satisfies Prisma.OrganizationInclude;

const ADMIN_ORG_DETAIL_INCLUDE = {
	merchantProfile: true,
	memberships: {
		where: { isDeleted: false },
		include: { user: { select: { id: true, email: true, fullName: true } } },
	},
	_count: { select: { memberships: { where: { isDeleted: false } } } },
} as const satisfies Prisma.OrganizationInclude;

export type OrganizationAdminListRow = Prisma.OrganizationGetPayload<{ include: typeof ADMIN_ORG_LIST_INCLUDE }>;
export type OrganizationAdminDetailRow = Prisma.OrganizationGetPayload<{ include: typeof ADMIN_ORG_DETAIL_INCLUDE }>;

@Injectable()
export class OrganizationRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findById(organizationId: string): Promise<(Organization & { merchantProfile: OrganizationMerchantProfile | null }) | null> {
		return this.prisma.organization.findFirst({
			where: { id: organizationId, isDeleted: false },
			include: { merchantProfile: true },
		});
	}

	public async findForAdminDetail(organizationId: string): Promise<OrganizationAdminDetailRow | null> {
		return this.prisma.organization.findFirst({
			where: { id: organizationId, isDeleted: false },
			include: ADMIN_ORG_DETAIL_INCLUDE,
		});
	}

	public async listForAdmin(query: AdminMerchantListQuery): Promise<RepositoryListResult<OrganizationAdminListRow>> {
		const where: Prisma.OrganizationWhereInput = {
			isDeleted: false,
			merchantProfile: { isNot: null },
			...(query.search !== undefined
				? {
						OR: [
							{ displayName: { contains: query.search, mode: "insensitive" } },
							{ slug: { contains: query.search, mode: "insensitive" } },
							{ merchantProfile: { legalName: { contains: query.search, mode: "insensitive" } } },
						],
					}
				: {}),
			...(query.city !== undefined ? { merchantProfile: { city: query.city } } : {}),
			...(query.kybStatus !== undefined ? { merchantProfile: { kybStatus: query.kybStatus } } : {}),
			...(query.status !== undefined
				? {
						lifecycleState: query.status === "ONBOARDING" ? "PROVISIONING" : query.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
					}
				: {}),
		};

		return fetchStringIdListPage(query, {
			where,
			mergeCursor: (baseWhere, cursorId) => ({ ...baseWhere, id: { gt: cursorId } }),
			readId: (row) => row.id,
			findMany: (args): Promise<OrganizationAdminListRow[]> =>
				this.prisma.organization.findMany({
					...args,
					include: ADMIN_ORG_LIST_INCLUDE,
				}),
			count: (listWhere) => this.prisma.organization.count({ where: listWhere }),
		});
	}

	public async updateMerchantProfileKyb(
		organizationId: string,
		data: { readonly kybStatus: OrganizationMerchantProfile["kybStatus"]; readonly kybFields?: Prisma.InputJsonValue },
	): Promise<void> {
		await this.prisma.organizationMerchantProfile.update({
			where: { organizationId },
			data: {
				kybStatus: data.kybStatus,
				...(data.kybFields !== undefined ? { kybFields: data.kybFields } : {}),
				updatedAt: BigInt(Date.now()),
			},
		});
	}

	public async updateMerchantProfileSubmission(
		organizationId: string,
		data: {
			readonly displayName?: string;
			readonly category?: string;
			readonly legalName: string;
			readonly addressText: string;
			readonly contactPhone: string;
			readonly kybFields: Prisma.InputJsonValue;
			readonly kybStatus: OrganizationMerchantProfile["kybStatus"];
		},
	): Promise<Organization & { merchantProfile: OrganizationMerchantProfile | null }> {
		const now = BigInt(Date.now());
		if (data.displayName !== undefined) {
			await this.prisma.organization.update({
				where: { id: organizationId },
				data: { displayName: data.displayName, updatedAt: now },
			});
		}
		await this.prisma.organizationMerchantProfile.update({
			where: { organizationId },
			data: {
				...(data.category !== undefined ? { category: data.category } : {}),
				legalName: data.legalName,
				addressText: data.addressText,
				contactPhone: data.contactPhone,
				kybFields: data.kybFields,
				kybStatus: data.kybStatus,
				updatedAt: now,
			},
		});
		const updated = await this.findById(organizationId);
		if (updated === null) {
			throw new Error(`Organization ${organizationId} not found after merchant profile update`);
		}
		return updated;
	}

	public async listOwnerUserIds(organizationId: string): Promise<string[]> {
		const rows = await this.prisma.organizationMembership.findMany({
			where: { organizationId, role: "OWNER", status: "ACTIVE", isDeleted: false },
			select: { userId: true },
		});
		return rows.map((row) => row.userId);
	}
}
