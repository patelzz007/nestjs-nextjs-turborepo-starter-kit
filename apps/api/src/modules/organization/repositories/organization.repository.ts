import { Injectable } from "@nestjs/common";
import type { Organization, OrganizationLifecycleState, OrganizationMerchantProfile, Prisma, PrismaClient } from "@prisma/client";

import { assertNever, adminMerchantListQuery, type AdminMerchantListQuery, type AdminMerchantListSortField, type MerchantOrgStatus } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter, type PrismaEqualityFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

/** A Prisma client or an interactive-transaction client. */
export type OrganizationDbClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

const ADMIN_ORG_LIST_INCLUDE = {
	merchantProfile: true,
	memberships: {
		where: { role: "OWNER", status: "ACTIVE", isDeleted: false },
		include: { user: { select: { id: true } } },
		take: 1,
	},
} satisfies Prisma.OrganizationInclude;

const ADMIN_ORG_DETAIL_INCLUDE = {
	merchantProfile: true,
	memberships: {
		where: { isDeleted: false },
		include: { user: { select: { id: true, email: true, fullName: true } } },
	},
	_count: { select: { memberships: { where: { isDeleted: false } } } },
} satisfies Prisma.OrganizationInclude;

export type OrganizationAdminListRow = Prisma.OrganizationGetPayload<{ include: typeof ADMIN_ORG_LIST_INCLUDE }>;
export type OrganizationAdminDetailRow = Prisma.OrganizationGetPayload<{ include: typeof ADMIN_ORG_DETAIL_INCLUDE }>;

// ── Admin merchant list query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const ADMIN_MERCHANT_SORT_COLUMNS: SortColumns<AdminMerchantListSortField, Prisma.OrganizationOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	displayName: (direction) => ({ displayName: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const ADMIN_MERCHANT_LIST_KEYSET: ListKeyset<OrganizationAdminListRow, Prisma.OrganizationWhereInput> = timestampIdKeyset(
	(row: OrganizationAdminListRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** Public merchant status → the organization lifecycle state it is stored as. */
function toLifecycleState(status: MerchantOrgStatus): OrganizationLifecycleState {
	switch (status) {
		case "ONBOARDING":
			return "PROVISIONING";
		case "ACTIVE":
			return "ACTIVE";
		case "SUSPENDED":
			return "SUSPENDED";
		default:
			return assertNever(status, "merchant status");
	}
}

/** Maps a translated status filter onto lifecycle states, operator by operator. */
function toLifecycleStateFilter(filter: PrismaEqualityFilter<MerchantOrgStatus>): PrismaEqualityFilter<OrganizationLifecycleState> {
	return {
		...(filter.equals !== undefined ? { equals: toLifecycleState(filter.equals) } : {}),
		...(filter.not !== undefined ? { not: toLifecycleState(filter.not) } : {}),
		...(filter.in !== undefined ? { in: filter.in.map(toLifecycleState) } : {}),
		...(filter.notIn !== undefined ? { notIn: filter.notIn.map(toLifecycleState) } : {}),
	};
}

/** Live merchant organizations + the filter AST + search. */
export function buildAdminMerchantListWhere(query: AdminMerchantListQuery): Prisma.OrganizationWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false, merchantProfile: { isNot: null } },
			...fieldWhere(toPrismaEqualityFilter(filter?.city), (city): Prisma.OrganizationWhereInput => ({ merchantProfile: { is: { city } } })),
			...fieldWhere(toPrismaEqualityFilter(filter?.kybStatus), (kybStatus): Prisma.OrganizationWhereInput => ({ merchantProfile: { is: { kybStatus } } })),
			...fieldWhere(toPrismaEqualityFilter(filter?.status), (status): Prisma.OrganizationWhereInput => ({ lifecycleState: toLifecycleStateFilter(status) })),
			...(query.search !== undefined
				? [
						{
							OR: [
								{ displayName: { contains: query.search, mode: "insensitive" } },
								{ slug: { contains: query.search, mode: "insensitive" } },
								{ merchantProfile: { is: { legalName: { contains: query.search, mode: "insensitive" } } } },
							],
						} satisfies Prisma.OrganizationWhereInput,
					]
				: []),
		],
	};
}

export function buildAdminMerchantListOrder(query: AdminMerchantListQuery): ListOrder<Prisma.OrganizationOrderByWithRelationInput> {
	return buildListOrder(adminMerchantListQuery.resolveSort(query.sort), {
		columns: ADMIN_MERCHANT_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

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
		return fetchListPage(query, {
			where: buildAdminMerchantListWhere(query),
			order: buildAdminMerchantListOrder(query),
			keyset: ADMIN_MERCHANT_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.organization.count({ where }),
			findMany: (args): Promise<OrganizationAdminListRow[]> => this.prisma.organization.findMany({ ...args, include: ADMIN_ORG_LIST_INCLUDE }),
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

	/** Stores the merchant's onboarding/KYB submission, inside the caller's transaction. */
	public async updateMerchantProfileSubmissionInTx(
		tx: OrganizationDbClient,
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
	): Promise<void> {
		const now = BigInt(Date.now());
		if (data.displayName !== undefined) {
			await tx.organization.update({
				where: { id: organizationId },
				data: { displayName: data.displayName, updatedAt: now },
			});
		}
		await tx.organizationMerchantProfile.update({
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
	}

	public async listOwnerUserIds(organizationId: string): Promise<string[]> {
		const rows = await this.prisma.organizationMembership.findMany({
			where: { organizationId, role: "OWNER", status: "ACTIVE", isDeleted: false },
			select: { userId: true },
		});
		return rows.map((row) => row.userId);
	}
}
