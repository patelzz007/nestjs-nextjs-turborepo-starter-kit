import type { OrganizationLocation } from "@prisma/client";
import { epochMs, type EpochMs, newRowId } from "@workspace/shared";

import { NotFoundError } from "../../../../platform/application/errors/app-error";
import { Location } from "../../domain/aggregates/location.aggregate";
import { LocationStatusConflictError } from "../../domain/errors/organizations.errors";
import type { LocationRepository, PersistedLocation, StoreAccessRemoval } from "../../domain/repositories/location.repository";
import { allocateUniqueLocationCode } from "./location-code";
import type { OrganizationsDb } from "./organization-db";
import { syncStoreForLocation } from "./store-sync";

/** Namespace of the per-organization advisory lock that serializes location writes (code allocation, pending quota, primary). */
const LOCATION_WRITE_LOCK_NAMESPACE = "organization-locations:";

/** A compare-and-set on a location lost to a concurrent change. */
const LOCATION_CHANGED_MESSAGE = "This store was changed by another request — reload and try again";

export function toPersistedLocation(row: OrganizationLocation): PersistedLocation {
	return {
		id: row.id,
		organizationId: row.organizationId,
		name: row.name,
		code: row.code,
		addressText: row.addressText,
		city: row.city,
		contactPhone: row.contactPhone,
		status: row.status,
		rejectionReason: row.rejectionReason,
		isPrimary: row.isPrimary,
		requestedByUserId: row.requestedByUserId,
		reviewedByUserId: row.reviewedByUserId,
		reviewedAt: row.reviewedAt === null ? null : epochMs(Number(row.reviewedAt)),
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	};
}

export class PrismaLocationRepository implements LocationRepository {
	public constructor(private readonly db: OrganizationsDb) {}

	public nextId(): string {
		return newRowId();
	}

	/**
	 * A transaction-scoped advisory lock: code allocation, the pending-request
	 * quota and the single primary location are read-then-write decisions, and
	 * under this lock two concurrent requests can no longer both pass one.
	 */
	public async lockOrganization(organizationId: string): Promise<void> {
		const lockKey = `${LOCATION_WRITE_LOCK_NAMESPACE}${organizationId}`;
		await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
	}

	public async countPending(organizationId: string): Promise<number> {
		return this.db.organizationLocation.count({ where: { organizationId, isDeleted: false, status: "PENDING_APPROVAL" } });
	}

	public async countActiveAmong(organizationId: string, locationIds: readonly string[]): Promise<number> {
		if (locationIds.length === 0) {
			return 0;
		}
		return this.db.organizationLocation.count({ where: { organizationId, isDeleted: false, status: "ACTIVE", id: { in: [...locationIds] } } });
	}

	public async activeNamesAmong(organizationId: string, locationIds: readonly string[]): Promise<readonly string[]> {
		const rows = await this.db.organizationLocation.findMany({
			where: { organizationId, isDeleted: false, status: "ACTIVE", id: { in: [...locationIds] } },
			select: { name: true },
			orderBy: { name: "asc" },
		});
		return rows.map((row) => row.name);
	}

	public async findLive(organizationId: string, locationId: string): Promise<Location | null> {
		const row = await this.db.organizationLocation.findFirst({ where: { id: locationId, organizationId, isDeleted: false } });
		return row === null ? null : Location.rehydrate(toPersistedLocation(row));
	}

	public async findLivePrimary(organizationId: string): Promise<Location | null> {
		const row = await this.db.organizationLocation.findFirst({ where: { organizationId, isPrimary: true, isDeleted: false } });
		return row === null ? null : Location.rehydrate(toPersistedLocation(row));
	}

	public async add(location: Location): Promise<PersistedLocation> {
		const snapshot = location.snapshot();
		// The code is chosen by read-then-insert; the lock makes that safe ((organization_id, code) stays the backstop).
		await this.lockOrganization(snapshot.organizationId);
		const code = await allocateUniqueLocationCode(this.db, snapshot.organizationId, snapshot.name);
		const now = BigInt(Date.now());
		const row = await this.db.organizationLocation.create({
			data: {
				id: snapshot.id,
				organizationId: snapshot.organizationId,
				name: snapshot.name,
				code,
				addressText: snapshot.addressText,
				city: snapshot.city,
				contactPhone: snapshot.contactPhone,
				status: snapshot.status,
				isPrimary: snapshot.isPrimary,
				requestedByUserId: snapshot.requestedByUserId,
				reviewedByUserId: snapshot.reviewedByUserId,
				reviewedAt: snapshot.reviewedAt === null ? null : BigInt(snapshot.reviewedAt),
				createdAt: now,
				updatedAt: now,
			},
		});
		await syncStoreForLocation(this.db, row);
		return toPersistedLocation(row);
	}

	public async save(location: Location): Promise<PersistedLocation> {
		const snapshot = location.snapshot();
		const loaded = location.concurrencyToken;
		if (loaded === null) {
			throw new Error(`Location ${snapshot.id} was never persisted`);
		}
		const { closure } = snapshot;
		const now = BigInt(Date.now());
		const result = await this.db.organizationLocation.updateMany({
			where: { id: snapshot.id, organizationId: snapshot.organizationId, isDeleted: false, status: loaded, ...(closure === null ? {} : { isPrimary: false }) },
			data: {
				name: snapshot.name,
				addressText: snapshot.addressText,
				city: snapshot.city,
				contactPhone: snapshot.contactPhone,
				status: snapshot.status,
				rejectionReason: snapshot.rejectionReason,
				requestedByUserId: snapshot.requestedByUserId,
				reviewedByUserId: snapshot.reviewedByUserId,
				reviewedAt: snapshot.reviewedAt === null ? null : BigInt(snapshot.reviewedAt),
				...(closure === null
					? { updatedAt: now }
					: { closureReason: closure.reason, isDeleted: true, deletedAt: closure.closedAt, deletedBy: closure.closedByUserId, updatedAt: closure.closedAt }),
			},
		});
		if (result.count !== 1) {
			throw new LocationStatusConflictError(LOCATION_CHANGED_MESSAGE);
		}
		const row = await this.db.organizationLocation.findFirstOrThrow({ where: { id: snapshot.id, organizationId: snapshot.organizationId } });
		await syncStoreForLocation(this.db, row);
		return toPersistedLocation(row);
	}

	public async removeStoreAccess(location: Location, closedByUserId: string, at: EpochMs): Promise<StoreAccessRemoval> {
		const store = await this.db.store.findUnique({ where: { locationId: location.id }, select: { id: true } });
		if (store === null) {
			throw new NotFoundError();
		}
		const memberships = await this.db.storeMembership.updateMany({
			where: { storeId: store.id, isDeleted: false },
			data: { isDeleted: true, deletedAt: at, deletedBy: closedByUserId, updatedAt: at },
		});
		// Soft-deleted like every business row: the scope history stays, and access reads only live rows.
		const scopes = await this.db.organizationMembershipLocationScope.updateMany({
			where: { locationId: location.id, scopeType: "SELECTED", isDeleted: false },
			data: { isDeleted: true, deletedAt: at, deletedBy: closedByUserId, updatedAt: at },
		});
		return { storeId: store.id, storeMembershipsRemoved: memberships.count, memberScopesRemoved: scopes.count };
	}
}
