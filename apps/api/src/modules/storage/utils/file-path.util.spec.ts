import { describe, expect, it } from "vitest";

import { buildFinalStoragePath, buildPublicVariantPath, buildStagingPath, isStagingPath, stripFileExtension, type BuildFileObjectPathInput } from "./file-path.util";

describe("file-path.util", () => {
	it("strips trailing extensions before rebuilding from MIME type", () => {
		expect(stripFileExtension("certificate.jpeg")).toBe("certificate");
		expect(stripFileExtension("photo.jpg")).toBe("photo");
		expect(stripFileExtension("no-extension")).toBe("no-extension");
	});

	it("builds ephemeral staging paths per category", () => {
		const productPath = buildStagingPath({
			category: "PRODUCT_IMAGE",
			ownerId: "product-1",
			fileId: "file-1",
			fileName: "photo.jpg",
			mimeType: "image/jpeg",
		});
		expect(productPath).toBe("staging/products/product-1/original/file-1-photo.jpg");

		const kybPath = buildStagingPath({
			category: "MERCHANT_KYB",
			ownerId: "org-1",
			fileId: "file-2",
			fileName: "registration.pdf",
			mimeType: "application/pdf",
		});
		expect(kybPath).toBe("staging/kyb/org-1/file-2-registration.pdf");
	});

	it("builds flat final storage paths without lifecycle segments", () => {
		expect(
			buildFinalStoragePath({
				category: "STORE_LOGO",
				ownerId: "org-1",
				fileId: "file-1",
				fileName: "logo.png",
				mimeType: "image/png",
			}),
		).toBe("stores/org-1/logo/file-1.png");

		expect(
			buildFinalStoragePath({
				category: "MERCHANT_KYB",
				ownerId: "org-1",
				fileId: "file-2",
				fileName: "scan.jpeg",
				mimeType: "image/jpeg",
			}),
		).toBe("kyb/org-1/file-2.jpg");
	});

	it("detects staging prefixes", () => {
		expect(isStagingPath("staging/kyb/org-1/file-1.pdf")).toBe(true);
		expect(isStagingPath("kyb/org-1/file-1.pdf")).toBe(false);
	});

	it("builds public variant paths for avatars", () => {
		const path = buildPublicVariantPath({
			category: "USER_AVATAR",
			ownerId: "user-1",
			fileId: "file-3",
			fileName: "avatar.webp",
			mimeType: "image/webp",
			variant: "THUMBNAIL",
		});
		expect(path).toBe("users/user-1/avatar/thumbnail/file-3.webp");
	});

	it("keeps reward images in their own folder under the organization", () => {
		const input: BuildFileObjectPathInput = { category: "REWARD_IMAGE", ownerId: "org-1", fileId: "file-4", fileName: "Kuih platter.webp", mimeType: "image/webp" };
		expect(buildStagingPath(input)).toBe("staging/stores/org-1/reward-images/file-4-Kuih platter.webp");
		expect(buildFinalStoragePath(input)).toBe("stores/org-1/reward-images/file-4.webp");
		expect(buildPublicVariantPath({ ...input, variant: "THUMBNAIL" })).toBe("stores/org-1/reward-images/thumbnail/file-4.webp");
	});

	it("keeps GitHub comment images in their own folder under the uploader", () => {
		const input: BuildFileObjectPathInput = { category: "GITHUB_COMMENT_IMAGE", ownerId: "user-1", fileId: "file-6", fileName: "screenshot.png", mimeType: "image/png" };
		expect(buildStagingPath(input)).toBe("staging/users/user-1/github-comment-images/file-6-screenshot.png");
		expect(buildFinalStoragePath(input)).toBe("users/user-1/github-comment-images/file-6.png");
	});

	it("nests variants under the category folder, except products, whose variants replace the original folder", () => {
		const product: BuildFileObjectPathInput = { category: "PRODUCT_IMAGE", ownerId: "product-1", fileId: "file-5", fileName: "photo.png", mimeType: "image/png" };
		expect(buildPublicVariantPath({ ...product, variant: "MEDIUM" })).toBe("products/product-1/medium/file-5.png");
		expect(buildPublicVariantPath({ ...product, category: "STORE_BANNER", ownerId: "org-1" })).toBe("stores/org-1/banner/original/file-5.png");
	});
});
