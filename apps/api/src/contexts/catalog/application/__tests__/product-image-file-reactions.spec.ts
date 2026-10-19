import { describe, expect, it } from "vitest";
import { epochMs, type EpochMs } from "@workspace/shared";

import { FileBindingTargetMissingError, FileDeleted, FileVerdictReached } from "../../../files/public-api";
import { BindProductImageOnFileVerdict } from "../event-handlers/in-transaction/bind-product-image-on-file-verdict.in-transaction-handler";
import { ReleaseProductImagesOnFileDeleted } from "../event-handlers/in-transaction/release-product-images-on-file-deleted.in-transaction-handler";
import { ProductImageFileGuard } from "../product-image-file-guard";
import type { ProductImageBindings, ProductImageFileScope } from "../ports/product-image-bindings.port";

const FILE_ID = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const NOW: EpochMs = epochMs(1_800_000_000_000);

/** A product gallery in memory: products that exist, and the rows appended / released. */
class InMemoryGallery implements ProductImageBindings {
	public readonly appended: [string, string][] = [];
	public readonly released: [string, string, number][] = [];

	public constructor(private readonly products: ReadonlySet<string>) {}

	public appendToGallery(productId: string, fileId: string): Promise<boolean> {
		if (!this.products.has(productId)) {
			return Promise.resolve(false);
		}
		this.appended.push([productId, fileId]);
		return Promise.resolve(true);
	}

	public releaseFile(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		this.released.push([fileId, deletedBy, deletedAt]);
		return Promise.resolve();
	}
}

function scope(products: readonly string[] = [PRODUCT_ID]): { scope: ProductImageFileScope; gallery: InMemoryGallery } {
	const gallery = new InMemoryGallery(new Set(products));
	return { scope: { productImages: gallery }, gallery };
}

function verdict(outcome: FileVerdictReached["outcome"], productId: string | null = PRODUCT_ID): FileVerdictReached {
	return new FileVerdictReached(NOW, FILE_ID, "PRODUCT_IMAGE", null, "user-1", outcome, productId);
}

describe("BindProductImageOnFileVerdict", () => {
	it("reacts to READY product images only", () => {
		const handler = new BindProductImageOnFileVerdict();

		expect(handler.accepts(verdict("READY"))).toBe(true);
		expect(handler.accepts(verdict("QUARANTINED"))).toBe(false);
		expect(handler.accepts(new FileVerdictReached(NOW, FILE_ID, "USER_AVATAR", null, "user-1", "READY", null))).toBe(false);
	});

	it("appends the image to its product's gallery", async () => {
		const { scope: files, gallery } = scope();

		await new BindProductImageOnFileVerdict().handle(verdict("READY"), files);

		expect(gallery.appended).toEqual([[PRODUCT_ID, FILE_ID]]);
	});

	it("fails the verdict when the product is gone or the file names none", async () => {
		await expect(new BindProductImageOnFileVerdict().handle(verdict("READY"), scope([]).scope)).rejects.toBeInstanceOf(FileBindingTargetMissingError);
		await expect(new BindProductImageOnFileVerdict().handle(verdict("READY", null), scope().scope)).rejects.toBeInstanceOf(FileBindingTargetMissingError);
	});
});

describe("ReleaseProductImagesOnFileDeleted", () => {
	it("soft-deletes the gallery rows of a deleted product image with who and when", async () => {
		const { scope: files, gallery } = scope();
		const deleted = new FileDeleted(NOW, FILE_ID, "PRODUCT_IMAGE", null, "user-1", []);
		const handler = new ReleaseProductImagesOnFileDeleted();

		expect(handler.accepts(new FileDeleted(NOW, FILE_ID, "STORE_LOGO", null, "user-1", []))).toBe(false);
		await handler.handle(deleted, files);

		expect(gallery.released).toEqual([[FILE_ID, "user-1", NOW]]);
	});
});

describe("ProductImageFileGuard", () => {
	it("never blocks, but asks for the files.delete operation because product_images is bypass-only", async () => {
		const guard = new ProductImageFileGuard();

		expect(guard.deletionScope).toBe("system-operation");
		expect(guard.categories).toEqual(["PRODUCT_IMAGE"]);
		await expect(guard.blockDelete()).resolves.toBeNull();
	});
});
