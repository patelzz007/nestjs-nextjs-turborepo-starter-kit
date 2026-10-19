import { createHash } from "node:crypto";

import type { StoredFile } from "@prisma/client";
import type { FileStatus } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { FakeImageProcessor, FILE_ID, InMemoryObjectStorage, ORG_ID, PDF_BYTES, imageRenditionsFor, storedFile } from "../../../../../../test/support/file-lifecycle-fakes";
import { toStoredFileView } from "../../persistence/stored-file.mapper";
import { InactiveStorageProviderError, StorageFileObjectAdapter } from "../storage-file-object.adapter";

const CONTAINER = "local-private-bucket";
const STAGING_PATH = `staging/kyb/${ORG_ID}/${FILE_ID}-licence.pdf`;
const CHECKSUM = createHash("sha256").update(PDF_BYTES).digest("hex");
/** The smallest bytes that pass the WebP magic-byte check (the fake processor decides the "decoded" size). */
const WEBP_BYTES = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(16)]);

function setup(
	file: Partial<StoredFile>,
	bytes: Buffer = PDF_BYTES,
	processor = new FakeImageProcessor(),
): { adapter: StorageFileObjectAdapter; view: ReturnType<typeof toStoredFileView>; storage: InMemoryObjectStorage } {
	const storage = new InMemoryObjectStorage();
	const row = storedFile({ status: "PENDING", sizeBytes: bytes.length, expectedChecksum: CHECKSUM, ...file });
	storage.put({ container: CONTAINER, path: row.storagePath }, bytes);
	const adapter = new StorageFileObjectAdapter(createTestTypedConfig({ STORAGE_PROVIDER: "local" }), storage, storage, imageRenditionsFor(storage, processor));
	return { adapter, view: toStoredFileView(row, "https://api.test"), storage };
}

function sha256(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

describe("StorageFileObjectAdapter.verifyUpload", () => {
	it("streams the checksum when the provider reports none, and returns what it read", async () => {
		const { adapter, view, storage } = setup({});

		await expect(adapter.verifyUpload(view, CHECKSUM)).resolves.toEqual({ actualChecksum: CHECKSUM, objectRevision: "head", imageWidth: null, imageHeight: null });
		expect(storage.streamed.length).toBeGreaterThan(0);
	});

	it("rejects a missing object, a size mismatch and bytes whose checksum differs", async () => {
		const missing = setup({});
		await missing.storage.deleteObject({ provider: "local", container: CONTAINER, path: STAGING_PATH });
		await expect(missing.adapter.verifyUpload(missing.view, CHECKSUM)).rejects.toMatchObject({ code: "FILE_OBJECT_MISSING" });

		const resized = setup({ sizeBytes: PDF_BYTES.length + 1 });
		await expect(resized.adapter.verifyUpload(resized.view, CHECKSUM)).rejects.toMatchObject({ code: "FILE_SIZE_MISMATCH" });

		const tampered = setup({});
		await expect(tampered.adapter.verifyUpload(tampered.view, "f".repeat(64))).rejects.toMatchObject({ code: "FILE_OBJECT_CHECKSUM_MISMATCH" });
	});

	it("rejects content whose magic bytes do not match the declared type", async () => {
		const html = Buffer.from("<html><script>alert(1)</script></html>");
		const { adapter, view } = setup({ expectedChecksum: sha256(html) }, html);

		await expect(adapter.verifyUpload(view, sha256(html))).rejects.toMatchObject({ code: "FILE_CONTENT_TYPE_MISMATCH" });
	});

	const rewardImage: Partial<StoredFile> = {
		category: "REWARD_IMAGE",
		visibility: "PUBLIC",
		mimeType: "image/webp",
		originalName: "kuih.webp",
		storagePath: `staging/stores/${ORG_ID}/reward-images/${FILE_ID}-kuih.webp`,
	};

	it("records an image's decoded size when it meets the category's pixel rules", async () => {
		const { adapter, view } = setup(rewardImage, WEBP_BYTES);

		await expect(adapter.verifyUpload(view, sha256(WEBP_BYTES))).resolves.toMatchObject({ imageWidth: 3840, imageHeight: 2160 });
	});

	it.each([
		{ size: { width: 4032, height: 3024 }, message: "Images must be 16:9 (landscape)." },
		{ size: { width: 1280, height: 720 }, message: "Images must be at least 1920 × 1080 pixels so they stay sharp on every screen." },
	])("refuses a $size.width×$size.height image, saying why", async ({ size, message }) => {
		const processor = new FakeImageProcessor();
		processor.dimensions = size;
		const { adapter, view } = setup(rewardImage, WEBP_BYTES, processor);

		await expect(adapter.verifyUpload(view, sha256(WEBP_BYTES))).rejects.toMatchObject({ code: "FILE_IMAGE_DIMENSIONS_INVALID", message });
	});

	it("refuses bytes that do not decode as an image, and never decodes a category without pixel rules", async () => {
		const unreadable = new FakeImageProcessor();
		unreadable.unreadable = true;
		const image = setup(rewardImage, WEBP_BYTES, unreadable);
		await expect(image.adapter.verifyUpload(image.view, sha256(WEBP_BYTES))).rejects.toMatchObject({ code: "FILE_IMAGE_UNREADABLE" });

		const pdf = setup({}, PDF_BYTES, unreadable);
		await expect(pdf.adapter.verifyUpload(pdf.view, CHECKSUM)).resolves.toMatchObject({ imageWidth: null });
	});

	it("refuses to touch an object stored on another provider", async () => {
		const { adapter, view } = setup({ storageProvider: "s3" });

		await expect(adapter.verifyUpload(view, CHECKSUM)).rejects.toBeInstanceOf(InactiveStorageProviderError);
	});
});

describe("StorageFileObjectAdapter.createDownloadUrl", () => {
	it.each<FileStatus>(["PENDING", "SCANNING", "QUARANTINED", "FAILED"])("issues no URL while the file is %s", async (status: FileStatus) => {
		const { adapter, view } = setup({ status });

		await expect(adapter.createDownloadUrl(view, "inline")).resolves.toEqual({ fileId: FILE_ID, status, downloadUrl: null, expiresAt: null });
	});

	it("signs a URL for a READY file", async () => {
		const { adapter, view } = setup({ status: "READY" });

		await expect(adapter.createDownloadUrl(view, "attachment")).resolves.toMatchObject({ downloadUrl: `https://storage.test/${FILE_ID}`, status: "READY" });
	});
});

describe("StorageFileObjectAdapter.withdrawPublicCopy", () => {
	it("withdraws the copy and reports the keys the CDN may still cache", async () => {
		const { adapter, storage } = setup({});
		storage.servesThroughCdn = true;

		await expect(adapter.withdrawPublicCopy(FILE_ID, { provider: "local", container: CONTAINER, path: "products/p/original/f.png" })).resolves.toEqual([
			"products/p/original/f.png",
		]);
		expect(storage.unpublished).toEqual([FILE_ID]);
	});
});
