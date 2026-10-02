import { Injectable } from "@nestjs/common";
import type { OrganizationLocation, OrganizationLocationStatus, PilotCity, Prisma, PrismaClient } from "@prisma/client";
import { adminLocationRequestListQuery, type AdminLocationRequestListQuery, type AdminLocationRequestListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { allocateUniqueLocationCode } from "../utils/organization-location-code.util";
import { syncStoreForLocation } from "../utils/store-sync.util";

type DbTx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

const ADMIN_LOCATION_REQUEST_INCLUDE = {
	organization: {
		select: {
			id: true,
			slug: true,
			displayName: true,
		},
	},
} satisfies Prisma.OrganizationLocationInclude;

export type AdminLocationRequestRow = Prisma.OrganizationLocationGetPayload<{ include: typeof ADMIN_LOCATION_REQUEST_INCLUDE }>;

// ── Admin location-request list query → Prisma (see docs/list-queries.md) ──

const ADMIN_LOCATION_REQUEST_SORT_COLUMNS: SortColumns<AdminLocationRequestListSortField, Prisma.OrganizationLocationOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	name: (direction) => ({ name: direction }),
};

/** Keyset for the default order (`createdAt asc, id asc` — oldest request first). */
const ADMIN_LOCATION_REQUEST_LIST_KEYSET: ListKeyset<AdminLocationRequestRow, Prisma.OrganizationLocationWhereInput> = timestampIdKeyset(
	(row: AdminLocationRequestRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationLocationWhereInput => ({ OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: id } }] }),
);

/** Live, non-primary locations (store requests) + the filter AST. */
export function buildAdminLocationRequestListWhere(query: AdminLocationRequestListQuery): Prisma.OrganizationLocationWhereInput {
	return {
		AND: [{ isDeleted: false, isPrimary: false }, ...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status) => ({ status }))],
	};
}

export function buildAdminLocationRequestListOrder(query: AdminLocationRequestListQuery): ListOrder<Prisma.OrganizationLocationOrderByWithRelationInput> {
	return buildListOrder(adminLocationRequestListQuery.resolveSort(query.sort), {
		columns: ADMIN_LOCATION_REQUEST_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

export interface CreateOrganizationLocationData {
	readonly organizationId: string;
	readonly name: string;
	readonly addressText: string;
	readonly city: PilotCity | null;
	readonly contactPhone: string | null;
	readonly status: OrganizationLocationStatus;
	readonly isPrimary: boolean;
	readonly requestedByUserId: string | null;
	readonly reviewedByUserId: string | null;
	readonly reviewedAt: bigint | null;
}

@Injectable()
export class OrganizationLocationRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findById(organizationId: string, locationId: string): Promise<OrganizationLocation | null> {
		return this.prisma.organizationLocation.findFirst({
			where: { id: locationId, organizationId, isDeleted: false },
		});
	}

	public async findPrimary(organizationId: string): Promise<OrganizationLocation | null> {
		return this.prisma.organizationLocation.findFirst({
			where: { organizationId, isPrimary: true, isDeleted: false },
		});
	}

	public async countPendingByOrganization(organizationId: string): Promise<number> {
		return this.prisma.organizationLocation.count({
			where: { organizationId, isDeleted: false, status: "PENDING_APPROVAL" },
		});
	}

	public async countActiveByOrganization(organizationId: string): Promise<number> {
		return this.prisma.organizationLocation.count({
			where: { organizationId, isDeleted: false, status: "ACTIVE" },
		});
	}

	public async findActiveIds(organizationId: string, locationIds: readonly string[]): Promise<string[]> {
		const rows = await this.prisma.organizationLocation.findMany({
			where: {
				organizationId,
				isDeleted: false,
				status: "ACTIVE",
				id: { in: [...locationIds] },
			},
			select: { id: true },
		});
		return rows.map((row) => row.id);
	}

	/** One page of the admin location-request queue, read inside the caller's (system-operation) transaction. */
	public async listAdminRequestsInTx(tx: DbTx, query: AdminLocationRequestListQuery): Promise<RepositoryListResult<AdminLocationRequestRow>> {
		return fetchListPage(query, {
			where: buildAdminLocationRequestListWhere(query),
			order: buildAdminLocationRequestListOrder(query),
			keyset: ADMIN_LOCATION_REQUEST_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => tx.organizationLocation.count({ where }),
			findMany: (args): Promise<AdminLocationRequestRow[]> => tx.organizationLocation.findMany({ ...args, include: ADMIN_LOCATION_REQUEST_INCLUDE }),
		});
	}

	public async create(tx: DbTx, data: CreateOrganizationLocationData): Promise<OrganizationLocation> {
		const code = await allocateUniqueLocationCode(tx, data.organizationId, data.name);
		const now = BigInt(Date.now());

		const location = await tx.organizationLocation.create({
			data: {
				organizationId: data.organizationId,
				name: data.name.trim(),
				code,
				addressText: data.addressText.trim(),
				city: data.city,
				contactPhone: data.contactPhone,
				status: data.status,
				isPrimary: data.isPrimary,
				requestedByUserId: data.requestedByUserId,
				reviewedByUserId: data.reviewedByUserId,
				reviewedAt: data.reviewedAt,
				createdAt: now,
				updatedAt: now,
			},
		});
		await syncStoreForLocation(tx, location);
		return location;
	}

	public async listByOrganization(organizationId: string): Promise<OrganizationLocation[]> {
		return this.prisma.organizationLocation.findMany({
			where: { organizationId, isDeleted: false },
			orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
		});
	}

	public async updatePrimaryFromOnboarding(
		tx: DbTx,
		organizationId: string,
		input: {
			readonly name: string;
			readonly addressText: string;
			readonly city: PilotCity;
			readonly contactPhone: string;
			readonly reviewedByUserId: string;
		},
	): Promise<OrganizationLocation> {
		const primary = await tx.organizationLocation.findFirst({
			where: { organizationId, isPrimary: true, isDeleted: false },
		});

		if (primary === null) {
			throw new Error("Primary organization location is missing");
		}

		const now = BigInt(Date.now());

		const location = await tx.organizationLocation.update({
			where: { id: primary.id },
			data: {
				name: input.name.trim(),
				addressText: input.addressText.trim(),
				city: input.city,
				contactPhone: input.contactPhone.trim(),
				status: "ACTIVE",
				reviewedByUserId: input.reviewedByUserId,
				reviewedAt: now,
				updatedAt: now,
			},
		});
		await syncStoreForLocation(tx, location);
		return location;
	}

	public async updateRejectedLocation(
		tx: DbTx,
		locationId: string,
		input: {
			readonly name: string;
			readonly addressText: string;
			readonly contactPhone: string | null;
			readonly requestedByUserId: string;
		},
	): Promise<OrganizationLocation> {
		const now = BigInt(Date.now());

		const location = await tx.organizationLocation.update({
			where: { id: locationId },
			data: {
				name: input.name.trim(),
				addressText: input.addressText.trim(),
				contactPhone: input.contactPhone,
				status: "PENDING_APPROVAL",
				rejectionReason: null,
				requestedByUserId: input.requestedByUserId,
				reviewedByUserId: null,
				reviewedAt: null,
				updatedAt: now,
			},
		});
		await syncStoreForLocation(tx, location);
		return location;
	}

	public async reviewLocation(
		tx: DbTx,
		locationId: string,
		input: {
			readonly approve: boolean;
			readonly rejectionReason: string | null;
			readonly reviewedByUserId: string;
		},
	): Promise<OrganizationLocation> {
		const now = BigInt(Date.now());

		const location = await tx.organizationLocation.update({
			where: { id: locationId },
			data: {
				status: input.approve ? "ACTIVE" : "REJECTED",
				rejectionReason: input.approve ? null : input.rejectionReason,
				reviewedByUserId: input.reviewedByUserId,
				reviewedAt: now,
				updatedAt: now,
			},
		});
		await syncStoreForLocation(tx, location);
		return location;
	}
}
