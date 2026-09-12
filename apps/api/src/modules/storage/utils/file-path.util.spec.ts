import { describe, expect, it } from "vitest";

import { buildFinalStoragePath, buildPublicVariantPath, buildStagingPath, isStagingPath, stripFileExtension } from "./file-path.util";

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
});
