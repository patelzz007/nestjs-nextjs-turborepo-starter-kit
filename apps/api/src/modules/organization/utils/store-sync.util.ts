import type { OrganizationLocation, PrismaClient, Store, StoreStatus } from "@prisma/client";

/** Any client or transaction exposing the `store` delegate. */
export interface StoreSyncClient {
	readonly store: PrismaClient["store"];
}

/** A store is operational only while its location is ACTIVE and not deleted. */
export function storeStatusForLocation(location: Pick<OrganizationLocation, "status" | "isDeleted">): StoreStatus {
	return location.status === "ACTIVE" && !location.isDeleted ? "ACTIVE" : "INACTIVE";
}

/**
 * Keep the 1:1 `Store` for a location in step with it (spec §35). Called in the
 * same transaction as every location write, so a store never drifts from the
 * location its terminals, rewards, and redemptions run at.
 */
export async function syncStoreForLocation(client: StoreSyncClient, location: OrganizationLocation): Promise<Store> {
	const data = {
		organizationId: location.organizationId,
		name: location.name,
		code: location.code,
		status: storeStatusForLocation(location),
		isDeleted: location.isDeleted,
		deletedAt: location.deletedAt,
		updatedAt: location.updatedAt,
	};
	return client.store.upsert({
		where: { locationId: location.id },
		create: { ...data, locationId: location.id, createdAt: location.createdAt },
		update: data,
	});
}
