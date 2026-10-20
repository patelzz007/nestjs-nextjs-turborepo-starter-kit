import { getFileCategoryPolicy, type CreateFileUploadUrlInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FileMimeTypeNotAllowedError, FileOwnerUnresolvedError, FileTooLargeError, FileUploadForbiddenError } from "../errors/files.errors";
import { assertAvatarIsUploadersOwn, assertUploadWithinCategoryPolicy, isOwnPersonalUpload, resolveFileOwnerId, resolveUploadOwnerId } from "../policies/file-upload.policy";

const upload: Pick<CreateFileUploadUrlInput, "fileName" | "mimeType" | "sizeBytes" | "checksumSha256"> = {
	fileName: "f.png",
	mimeType: "image/png",
	sizeBytes: 10,
	checksumSha256: "a".repeat(64),
};

describe("assertUploadWithinCategoryPolicy", () => {
	it("accepts the category's limit exactly and returns its policy", () => {
		const policy = getFileCategoryPolicy("USER_AVATAR");

		expect(assertUploadWithinCategoryPolicy({ category: "USER_AVATAR", mimeType: "image/png", sizeBytes: policy.maxBytes })).toBe(policy);
	});

	it("refuses one byte over the limit and a MIME type the category does not accept", () => {
		const policy = getFileCategoryPolicy("USER_AVATAR");

		expect(() => assertUploadWithinCategoryPolicy({ category: "USER_AVATAR", mimeType: "image/png", sizeBytes: policy.maxBytes + 1 })).toThrow(FileTooLargeError);
		expect(() => assertUploadWithinCategoryPolicy({ category: "USER_AVATAR", mimeType: "application/pdf", sizeBytes: 10 })).toThrow(FileMimeTypeNotAllowedError);
	});
});

describe("resolveUploadOwnerId", () => {
	it("namespaces each category under the resource that owns it", () => {
		expect(resolveUploadOwnerId({ ...upload, category: "PRODUCT_IMAGE", productId: "product-1" })).toBe("product-1");
		expect(resolveUploadOwnerId({ ...upload, category: "USER_AVATAR", userId: "user-1" })).toBe("user-1");
		expect(resolveUploadOwnerId({ ...upload, category: "GITHUB_COMMENT_IMAGE", userId: "user-1" })).toBe("user-1");
		expect(resolveUploadOwnerId({ ...upload, category: "REWARD_IMAGE", tenantId: "org-1" })).toBe("org-1");
	});

	it("refuses an upload whose owner is missing", () => {
		expect(() => resolveUploadOwnerId({ ...upload, category: "GITHUB_COMMENT_IMAGE" })).toThrow(FileOwnerUnresolvedError);
	});
});

describe("resolveFileOwnerId (stored columns)", () => {
	it("reads the uploader for personal files and the tenant or product otherwise", () => {
		expect(resolveFileOwnerId({ category: "GITHUB_COMMENT_IMAGE", productId: null, tenantId: null, userId: "user-7" })).toBe("user-7");
		expect(resolveFileOwnerId({ category: "STORE_LOGO", productId: null, tenantId: "org-1", userId: "user-7" })).toBe("org-1");
		expect(resolveFileOwnerId({ category: "PRODUCT_IMAGE", productId: "product-1", tenantId: null, userId: "user-7" })).toBe("product-1");
	});

	it("refuses a stored tenant file without its tenant", () => {
		expect(() => resolveFileOwnerId({ category: "REWARD_IMAGE", productId: null, tenantId: null, userId: "user-7" })).toThrow(FileOwnerUnresolvedError);
	});
});

describe("personal uploads", () => {
	it("are only for yourself — an avatar even for a SuperAdmin", () => {
		expect(isOwnPersonalUpload("user-1", { userId: "user-1" })).toBe(true);
		expect(isOwnPersonalUpload("user-1", { userId: "user-2" })).toBe(false);
		expect(() => {
			assertAvatarIsUploadersOwn("user-1", { category: "USER_AVATAR", userId: "user-2" });
		}).toThrow(FileUploadForbiddenError);
		expect(() => {
			assertAvatarIsUploadersOwn("user-1", { category: "STORE_LOGO", userId: "user-2" });
		}).not.toThrow();
	});
});
