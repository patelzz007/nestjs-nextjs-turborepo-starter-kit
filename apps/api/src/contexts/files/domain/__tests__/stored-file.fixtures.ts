import { epochMs, FileStatusSchema, type EpochMs, type FileStatus, type StorageObjectLocator } from "@workspace/shared";

import type { StoredFileState } from "../aggregates/stored-file.aggregate";

export const FILE_ID = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";
export const UPLOADER_ID = "11111111-1111-4111-8111-111111111111";
export const ORG_ID = "22222222-2222-4222-8222-222222222222";
export const CHECKSUM = "a".repeat(64);
export const NOW: EpochMs = epochMs(1_800_000_000_000);

/** Every status the shared enum knows, for table-driven transition tests. */
export const FILE_STATUSES_FOR_TEST: readonly FileStatus[] = FileStatusSchema.options;

export function locator(path: string): StorageObjectLocator {
	return { provider: "local", container: "local-private-bucket", path, revision: null };
}

export function state(overrides: Partial<StoredFileState> = {}): StoredFileState {
	return {
		id: FILE_ID,
		category: "MERCHANT_KYB",
		visibility: "PRIVATE",
		status: "PENDING",
		isDeleted: false,
		uploadedById: UPLOADER_ID,
		organizationId: ORG_ID,
		productId: null,
		expectedChecksum: CHECKSUM,
		original: { slot: "ORIGINAL", locator: locator(`staging/kyb/${ORG_ID}/${FILE_ID}-licence.pdf`), publicPath: null },
		renditions: [],
		...overrides,
	};
}
