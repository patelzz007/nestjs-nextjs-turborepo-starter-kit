import { FileCategory, FileStatus, FileVisibility, type StoredFile } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { inferStorageProviderFromContainer, legacyBucketFieldsFromLocator, locatorFromStoredFile, toStorageObjectLocator } from "./storage-locator.util";

function storedFile(overrides: Partial<StoredFile>): StoredFile {
	return {
		id: "file-1",
		category: FileCategory.MERCHANT_KYB,
		visibility: FileVisibility.PRIVATE,
		originalName: "a.pdf",
		mimeType: "application/pdf",
		sizeBytes: 1024,
		expectedChecksum: "checksum",
		actualChecksum: null,
		storageProvider: null,
		storageContainer: null,
		objectRevision: null,
		storageBucket: "bucket",
		storagePath: "staging/a.pdf",
		publicPath: null,
		objectGeneration: null,
		status: FileStatus.READY,
		scanStatus: null,
		scannedAt: null,
		scanResult: null,
		uploadedById: "user-1",
		organizationId: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: 0n,
		updatedAt: 0n,
		...overrides,
	};
}

describe("storage-locator.util", () => {
	it("infers local provider from local-* containers", () => {
		expect(inferStorageProviderFromContainer("local-private-bucket")).toBe("local");
		expect(inferStorageProviderFromContainer("rewardhub")).toBe("s3");
	});

	it("builds a neutral locator", () => {
		const locator = toStorageObjectLocator("firebase", "my-bucket", "staging/users/a.pdf", "42");
		expect(locator).toEqual({
			provider: "firebase",
			container: "my-bucket",
			path: "staging/users/a.pdf",
			revision: "42",
		});
	});

	it("maps locator fields to legacy bucket columns", () => {
		const locator = toStorageObjectLocator("s3", "rewardhub", "staging/x.png", "gen-1");
		expect(legacyBucketFieldsFromLocator(locator)).toEqual({
			storageBucket: "rewardhub",
			objectGeneration: "gen-1",
			storageProvider: "s3",
			storageContainer: "rewardhub",
			objectRevision: "gen-1",
		});
	});

	it("reads neutral columns first and rejects cross-provider access", () => {
		const file = storedFile({
			id: "file-1",
			storageProvider: "s3",
			storageContainer: "rewardhub",
			storageBucket: "legacy-bucket",
			storagePath: "staging/a.pdf",
			objectRevision: "rev-1",
			objectGeneration: "gen-legacy",
		});

		expect(locatorFromStoredFile(file, "s3")).toEqual({
			provider: "s3",
			container: "rewardhub",
			path: "staging/a.pdf",
			revision: "rev-1",
		});

		expect(() => locatorFromStoredFile(file, "firebase")).toThrow(/active provider/);
	});

	it("falls back to legacy bucket/generation when neutral columns are missing", () => {
		const file = storedFile({
			id: "file-2",
			storageProvider: null,
			storageContainer: null,
			storageBucket: "local-private-bucket",
			storagePath: "staging/b.pdf",
			objectRevision: null,
			objectGeneration: "legacy-gen",
		});

		expect(locatorFromStoredFile(file, "local")).toEqual({
			provider: "local",
			container: "local-private-bucket",
			path: "staging/b.pdf",
			revision: "legacy-gen",
		});
	});
});
