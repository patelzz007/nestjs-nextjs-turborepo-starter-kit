import type { StoredFile } from "@prisma/client";
import type { CreateFileUploadUrlInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FileOwnerUnresolvedError, resolveStorageOwnerId, resolveUploadOwnerId } from "./file-ownership.util";

const upload: Pick<CreateFileUploadUrlInput, "fileName" | "mimeType" | "sizeBytes" | "checksumSha256"> = {
	fileName: "f.png",
	mimeType: "image/png",
	sizeBytes: 10,
	checksumSha256: "a".repeat(64),
};

function stored(overrides: Pick<StoredFile, "category"> & Partial<StoredFile>): StoredFile {
	return {
		id: "file-1",
		visibility: "PUBLIC",
		originalName: "f.png",
		mimeType: "image/png",
		sizeBytes: 10,
		expectedChecksum: "a".repeat(64),
		actualChecksum: null,
		storageProvider: null,
		storageContainer: null,
		objectRevision: null,
		storageBucket: "private",
		storagePath: "users/user-1/f.png",
		publicPath: null,
		objectGeneration: null,
		imageWidth: null,
		imageHeight: null,
		status: "READY",
		scanStatus: null,
		scannedAt: null,
		scanResult: null,
		uploadedById: "user-1",
		productId: null,
		deletedBy: null,
		organizationId: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: 0n,
		updatedAt: 0n,
		...overrides,
	};
}

describe("resolveUploadOwnerId", () => {
	it("namespaces each category under the resource that owns it", () => {
		expect(resolveUploadOwnerId({ ...upload, category: "PRODUCT_IMAGE", productId: "product-1" })).toBe("product-1");
		expect(resolveUploadOwnerId({ ...upload, category: "USER_AVATAR", userId: "user-1" })).toBe("user-1");
		expect(resolveUploadOwnerId({ ...upload, category: "GITHUB_COMMENT_IMAGE", userId: "user-1" })).toBe("user-1");
		expect(resolveUploadOwnerId({ ...upload, category: "REWARD_IMAGE", organizationId: "org-1" })).toBe("org-1");
	});

	it("refuses an upload whose owner is missing", () => {
		expect(() => resolveUploadOwnerId({ ...upload, category: "GITHUB_COMMENT_IMAGE" })).toThrow(FileOwnerUnresolvedError);
	});
});

describe("resolveStorageOwnerId", () => {
	it("reads the owner from the stored columns: the uploader for personal files", () => {
		expect(resolveStorageOwnerId(stored({ category: "GITHUB_COMMENT_IMAGE", uploadedById: "user-7" }))).toBe("user-7");
		expect(resolveStorageOwnerId(stored({ category: "USER_AVATAR", uploadedById: "user-7" }))).toBe("user-7");
		expect(resolveStorageOwnerId(stored({ category: "STORE_LOGO", organizationId: "org-1" }))).toBe("org-1");
		expect(resolveStorageOwnerId(stored({ category: "PRODUCT_IMAGE", productId: "product-1" }))).toBe("product-1");
	});

	it("refuses a stored organization file without its organization", () => {
		expect(() => resolveStorageOwnerId(stored({ category: "REWARD_IMAGE" }))).toThrow(FileOwnerUnresolvedError);
	});
});
