import type { Location as LocationRecord } from "@prisma/client";
import { epochMs, type EpochMs, newRowId } from "@workspace/shared";

import { Location } from "../../domain/aggregates/location.aggregate";
import { LocationStatusConflictError } from "../../domain/errors/tenants.errors";
import type { LocationRepository, PersistedLocation } from "../../domain/repositories/location.repository";
import { allocateUniqueLocationCode } from "./location-code";
import type { TenantsDb } from "./tenant-db";

/** Namespace of the per-tenant advisory lock that serializes location writes (code allocation, pending quota, primary). */
const LOCATION_WRITE_LOCK_NAMESPACE = "tenant-locations:";

/** A compare-and-set on a location lost to a concurrent change. */
const LOCATION_CHANGED_MESSAGE = "This store was changed by another request — reload and try again";

export function toPersistedLocation(row: LocationRecord): PersistedLocation {
	return {
		id: row.id,
		tenantId: row.tenantId,
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
	public constructor(private readonly db: TenantsDb) {}

	public nextId(): string {
		return newRowId();
	}

	/**
	 * A transaction-scoped advisory lock: code allocation, the pending-request
	 * quota and the single primary location are read-then-write decisions, and
	 * under this lock two concurrent requests can no longer both pass one.
	 */
	public async lockTenant(tenantId: string): Promise<void> {
		const lockKey = `${LOCATION_WRITE_LOCK_NAMESPACE}${tenantId}`;
		await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
	}

	public async countPending(tenantId: string): Promise<number> {
		return this.db.location.count({ where: { tenantId, isDeleted: false, status: "PENDING_APPROVAL" } });
	}

	public async countActiveAmong(tenantId: string, locationIds: readonly string[]): Promise<number> {
		if (locationIds.length === 0) {
			return 0;
		}
		return this.db.location.count({ where: { tenantId, isDeleted: false, status: "ACTIVE", id: { in: [...locationIds] } } });
	}

	public async activeNamesAmong(tenantId: string, locationIds: readonly string[]): Promise<readonly string[]> {
		const rows = await this.db.location.findMany({
			where: { tenantId, isDeleted: false, status: "ACTIVE", id: { in: [...locationIds] } },
			select: { name: true },
			orderBy: { name: "asc" },
		});
		return rows.map((row) => row.name);
	}

	public async findLive(tenantId: string, locationId: string): Promise<Location | null> {
		const row = await this.db.location.findFirst({ where: { id: locationId, tenantId, isDeleted: false } });
		return row === null ? null : Location.rehydrate(toPersistedLocation(row));
	}

	public async findLivePrimary(tenantId: string): Promise<Location | null> {
		const row = await this.db.location.findFirst({ where: { tenantId, isPrimary: true, isDeleted: false } });
		return row === null ? null : Location.rehydrate(toPersistedLocation(row));
	}

	public async add(location: Location): Promise<PersistedLocation> {
		const snapshot = location.snapshot();
		// The code is chosen by read-then-insert; the lock makes that safe ((tenant_id, code) stays the backstop).
		await this.lockTenant(snapshot.tenantId);
		const code = await allocateUniqueLocationCode(this.db, snapshot.tenantId, snapshot.name);
		const now = BigInt(Date.now());
		const row = await this.db.location.create({
			data: {
				id: snapshot.id,
				tenantId: snapshot.tenantId,
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
		const result = await this.db.location.updateMany({
			where: { id: snapshot.id, tenantId: snapshot.tenantId, isDeleted: false, status: loaded, ...(closure === null ? {} : { isPrimary: false }) },
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
		const row = await this.db.location.findFirstOrThrow({ where: { id: snapshot.id, tenantId: snapshot.tenantId } });
		return toPersistedLocation(row);
	}

	public async removeMemberScopes(location: Location, closedByUserId: string, at: EpochMs): Promise<number> {
		// Soft-deleted like every business row: the scope history stays, and access (with the location
		// role a row carries) reads only live rows.
		const scopes = await this.db.membershipLocationScope.updateMany({
			where: { locationId: location.id, scopeType: "SELECTED", isDeleted: false },
			data: { isDeleted: true, deletedAt: at, deletedBy: closedByUserId, updatedAt: at },
		});
		return scopes.count;
	}
}
