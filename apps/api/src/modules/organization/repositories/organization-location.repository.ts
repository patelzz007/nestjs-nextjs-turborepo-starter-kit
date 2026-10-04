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

// ── Admin location-request list query → Prisma (see docs/technical/api/list-queries.md) ──

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

/** Address + contact details of the primary store, submitted during merchant onboarding. */
export interface PrimaryLocationDetails {
	readonly name: string;
	readonly addressText: string;
	readonly city: PilotCity;
	readonly contactPhone: string;
	readonly reviewedByUserId: string;
}

/** Namespace of the per-organization advisory lock that serializes location writes (code allocation, pending quota, primary). */
const LOCATION_WRITE_LOCK_NAMESPACE = "organization-locations:";

@Injectable()
export class OrganizationLocationRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findById(organizationId: string, locationId: string): Promise<OrganizationLocation | null> {
		return this.prisma.organizationLocation.findFirst({
			where: { id: locationId, organizationId, isDeleted: false },
		});
	}

	/** A live location of `organizationId`, read inside the caller's transaction. */
	public async findByIdInTx(tx: DbTx, organizationId: string, locationId: string): Promise<OrganizationLocation | null> {
		return tx.organizationLocation.findFirst({
			where: { id: locationId, organizationId, isDeleted: false },
		});
	}

	public async findPrimary(organizationId: string): Promise<OrganizationLocation | null> {
		return this.prisma.organizationLocation.findFirst({
			where: { organizationId, isPrimary: true, isDeleted: false },
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

	/**
	 * Serialize every location write of one organization for the rest of the
	 * caller's transaction (a transaction-scoped advisory lock, released on
	 * commit/rollback). Location-code allocation, the pending-request quota and
	 * the single primary location are all read-then-write decisions; under this
	 * lock two concurrent requests can no longer both pass the same check.
	 */
	public async lockOrganizationLocationsInTx(tx: DbTx, organizationId: string): Promise<void> {
		const lockKey = `${LOCATION_WRITE_LOCK_NAMESPACE}${organizationId}`;
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
	}

	/** Pending store requests of `organizationId`, counted inside the caller's (locked) transaction. */
	public async countPendingByOrganizationInTx(tx: DbTx, organizationId: string): Promise<number> {
		return tx.organizationLocation.count({
			where: { organizationId, isDeleted: false, status: "PENDING_APPROVAL" },
		});
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
		// The code is chosen by read-then-insert; the lock makes that safe (the
		// (organization_id, code) unique index stays the backstop).
		await this.lockOrganizationLocationsInTx(tx, data.organizationId);
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

	/**
	 * Create the organization's ACTIVE primary store from the onboarding
	 * submission, or — for an organization provisioned before primaries were
	 * created at onboarding — complete the existing address-less primary. Runs
	 * under the organization's location lock; the one-live-primary partial
	 * unique index is the backstop.
	 */
	public async upsertPrimaryFromOnboardingInTx(tx: DbTx, organizationId: string, details: PrimaryLocationDetails): Promise<OrganizationLocation> {
		await this.lockOrganizationLocationsInTx(tx, organizationId);
		const existing = await tx.organizationLocation.findFirst({
			where: { organizationId, isPrimary: true, isDeleted: false },
			select: { id: true },
		});
		const reviewedAt = BigInt(Date.now());

		if (existing === null) {
			return this.create(tx, {
				organizationId,
				name: details.name,
				addressText: details.addressText,
				city: details.city,
				contactPhone: details.contactPhone.trim(),
				status: "ACTIVE",
				isPrimary: true,
				requestedByUserId: details.reviewedByUserId,
				reviewedByUserId: details.reviewedByUserId,
				reviewedAt,
			});
		}

		const location = await tx.organizationLocation.update({
			where: { id: existing.id },
			data: {
				name: details.name.trim(),
				addressText: details.addressText.trim(),
				city: details.city,
				contactPhone: details.contactPhone.trim(),
				status: "ACTIVE",
				reviewedByUserId: details.reviewedByUserId,
				reviewedAt,
				updatedAt: reviewedAt,
			},
		});
		await syncStoreForLocation(tx, location);
		return location;
	}

	/**
	 * Compare-and-set REJECTED → PENDING_APPROVAL with the corrected details.
	 * Returns `null` when the location is not (or no longer) a REJECTED live
	 * location of `organizationId` — a concurrent resubmit or review won.
	 */
	public async resubmitRejectedLocationInTx(
		tx: DbTx,
		organizationId: string,
		locationId: string,
		input: {
			readonly name: string;
			readonly addressText: string;
			readonly contactPhone: string | null;
			readonly requestedByUserId: string;
		},
	): Promise<OrganizationLocation | null> {
		const now = BigInt(Date.now());
		const result = await tx.organizationLocation.updateMany({
			where: { id: locationId, organizationId, isDeleted: false, status: "REJECTED" },
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
		return result.count === 1 ? this.syncedLocationInTx(tx, organizationId, locationId) : null;
	}

	/**
	 * Compare-and-set PENDING_APPROVAL → ACTIVE / REJECTED. Returns `null` when
	 * the location is not (or no longer) a pending live location of
	 * `organizationId` — a concurrent review won.
	 */
	public async reviewPendingLocationInTx(
		tx: DbTx,
		organizationId: string,
		locationId: string,
		input: {
			readonly approve: boolean;
			readonly rejectionReason: string | null;
			readonly reviewedByUserId: string;
		},
	): Promise<OrganizationLocation | null> {
		const now = BigInt(Date.now());
		const result = await tx.organizationLocation.updateMany({
			where: { id: locationId, organizationId, isDeleted: false, status: "PENDING_APPROVAL" },
			data: {
				status: input.approve ? "ACTIVE" : "REJECTED",
				rejectionReason: input.approve ? null : input.rejectionReason,
				reviewedByUserId: input.reviewedByUserId,
				reviewedAt: now,
				updatedAt: now,
			},
		});
		return result.count === 1 ? this.syncedLocationInTx(tx, organizationId, locationId) : null;
	}

	/**
	 * Compare-and-set: soft-delete (close) a live, non-primary location and
	 * mirror the closure onto its store. Returns `null` when the location is not
	 * (or no longer) a live non-primary location of `organizationId` — a
	 * concurrent close won, or it is the primary store.
	 */
	public async closeLocationInTx(
		tx: DbTx,
		organizationId: string,
		locationId: string,
		input: { readonly reason: string; readonly closedByUserId: string; readonly at: number },
	): Promise<OrganizationLocation | null> {
		const result = await tx.organizationLocation.updateMany({
			where: { id: locationId, organizationId, isDeleted: false, isPrimary: false },
			data: {
				status: "INACTIVE",
				closureReason: input.reason,
				isDeleted: true,
				deletedAt: input.at,
				deletedBy: input.closedByUserId,
				updatedAt: input.at,
			},
		});
		return result.count === 1 ? this.syncedLocationInTx(tx, organizationId, locationId) : null;
	}

	/** Re-read a location just written in this transaction and mirror it onto its store. */
	private async syncedLocationInTx(tx: DbTx, organizationId: string, locationId: string): Promise<OrganizationLocation> {
		const location = await tx.organizationLocation.findFirstOrThrow({ where: { id: locationId, organizationId } });
		await syncStoreForLocation(tx, location);
		return location;
	}
}
