import type { FileCategory } from "@workspace/shared";

/** The organization asset a store-branding category binds to. */
export type OrganizationAssetSlot = "LOGO" | "BANNER";

/** Organizations' file-backed rows (`OrganizationAsset`, `OrganizationKybFile`), bound to one transaction. */
export interface OrganizationFileBindings {
	/** Makes a READY file the organization's live asset of that slot (replacing any previous one, reviving a released row). */
	bindStoreAsset(organizationId: string, slot: OrganizationAssetSlot, fileId: string, boundAt: number): Promise<void>;
	/** Soft-deletes the live asset rows of a deleted file. */
	releaseStoreAsset(fileId: string, deletedBy: string, deletedAt: number): Promise<void>;
	/** Retires (soft-deletes, deactivates) the KYB links of a deleted upload. */
	releaseKybEvidence(fileId: string, deletedBy: string, deletedAt: number): Promise<void>;
	/** Whether the file was ever linked to a KYB submission (live or retired: the review history). */
	isKybEvidence(fileId: string): Promise<boolean>;
}

/** What organizations' file reactions can touch inside the files transaction. */
export interface OrganizationFileScope {
	readonly organizationFiles: OrganizationFileBindings;
}

/** The store-branding categories and the asset slot each binds to. */
export const STORE_ASSET_SLOT_OF: Readonly<Partial<Record<FileCategory, OrganizationAssetSlot>>> = {
	STORE_LOGO: "LOGO",
	STORE_BANNER: "BANNER",
};
