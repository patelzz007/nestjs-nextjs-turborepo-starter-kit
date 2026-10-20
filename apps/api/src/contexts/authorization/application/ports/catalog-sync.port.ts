import type { PermissionDefinition } from "@workspace/shared";

/** What the permission registry sync changed (registry → database only). */
export interface PermissionRegistrySyncResult {
	readonly created: readonly PermissionDefinition[];
	readonly updated: readonly PermissionDefinition[];
	/** Rows not in the code registry: admin-created or legacy. Never deleted. */
	readonly orphaned: readonly { readonly id: string; readonly action: string; readonly resource: string }[];
}

/** What converging the PLATFORM capability definitions changed. */
export interface CapabilityCatalogSyncResult {
	readonly created: number;
	readonly updated: number;
}

/** Boot-time catalog writes, bound to one transaction. */
export interface AuthorizationCatalogStore {
	/**
	 * `pg_advisory_xact_lock` on the catalog-sync key: replicas booting together run the sync one at a
	 * time, so none inserts a row another is inserting (decision #45, D21).
	 */
	lockCatalogSync(): Promise<void>;
	syncPermissionDefinitions(definitions: readonly PermissionDefinition[]): Promise<PermissionRegistrySyncResult>;
	convergePlatformCapabilities(): Promise<CapabilityCatalogSyncResult>;
}

/** What one reference-data section changed. All zeros: the database already matched the catalog. */
export interface ReferenceDataSectionChange {
	readonly created: number;
	readonly updated: number;
	readonly restored: number;
	readonly retired: number;
}

export interface ReferenceDataSectionReport {
	readonly section: string;
	readonly change: ReferenceDataSectionChange;
}

export interface ReferenceDataSyncReport {
	readonly sections: readonly ReferenceDataSectionReport[];
	readonly totalChanges: number;
}

/**
 * `db:sync-reference-data`: converges the permission catalog, system roles, their grants and the
 * merchant capability catalog, one section per transaction under `reference_data.sync`, with one
 * `REFERENCE_DATA_SYNCED` audit row per changed section.
 */
export interface ReferenceDataSyncPort {
	sync(): Promise<ReferenceDataSyncReport>;
}
