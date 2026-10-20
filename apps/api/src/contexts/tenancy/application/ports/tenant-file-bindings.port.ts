import type { FileCategory } from "@workspace/shared";

/** The tenant asset a store-branding category binds to. */
export type TenantAssetSlot = "LOGO" | "BANNER";

/** Tenants' file-backed rows (`TenantAsset`, `TenantKybFile`), bound to one transaction. */
export interface TenantFileBindings {
	/** Makes a READY file the tenant's live asset of that slot (replacing any previous one, reviving a released row). */
	bindStoreAsset(tenantId: string, slot: TenantAssetSlot, fileId: string, boundAt: number): Promise<void>;
	/** Soft-deletes the live asset rows of a deleted file. */
	releaseStoreAsset(fileId: string, deletedBy: string, deletedAt: number): Promise<void>;
	/** Retires (soft-deletes, deactivates) the KYB links of a deleted upload. */
	releaseKybEvidence(fileId: string, deletedBy: string, deletedAt: number): Promise<void>;
	/** Whether the file was ever linked to a KYB submission (live or retired: the review history). */
	isKybEvidence(fileId: string): Promise<boolean>;
}

/** What tenants' file reactions can touch inside the files transaction. */
export interface TenantFileScope {
	readonly tenantFiles: TenantFileBindings;
}

/** The store-branding categories and the asset slot each binds to. */
export const STORE_ASSET_SLOT_OF: Readonly<Partial<Record<FileCategory, TenantAssetSlot>>> = {
	STORE_LOGO: "LOGO",
	STORE_BANNER: "BANNER",
};
