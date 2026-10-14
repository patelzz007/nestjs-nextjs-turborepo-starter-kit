import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import { BadRequestException, ConflictException } from "@nestjs/common";
import type { FileStatus, StorageCdnInvalidationJob, StorageDeleteJob } from "@workspace/shared";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
	FILE_ID,
	ImmediateTransactions,
	InMemoryObjectStorage,
	InMemoryStoredFileRepository,
	listenerRegistry,
	ORG_ID,
	PDF_BYTES,
	storedFile,
	UPLOADER_ID,
	FakeImageProcessor,
	imageRenditionsFor,
} from "../../../../test/support/file-lifecycle-fakes";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { StreamChunkSchema, streamChunkToBuffer } from "../../storage/utils/object-stream.util";
import { FileFinalizationService } from "./file-finalization.service";
import { FileService } from "./file.service";
import { StorageTaskDispatcher } from "./storage-task-dispatcher";

const CONTAINER = "local-private-bucket";
const STAGING_PATH = `staging/kyb/${ORG_ID}/${FILE_ID}-licence.pdf`;
const CHECKSUM = createHash("sha256").update(PDF_BYTES).digest("hex");

/** Records dispatches instead of running them. */
class RecordingDispatcher extends StorageTaskDispatcher {
	public readonly scans: string[] = [];
	public readonly deletes: StorageDeleteJob[] = [];
	public readonly cdnInvalidations: StorageCdnInvalidationJob[] = [];

	public dispatchScan(fileId: string): Promise<void> {
		this.scans.push(fileId);
		return Promise.resolve();
	}

	public redispatchScan(fileId: string): Promise<void> {
		return this.dispatchScan(fileId);
	}

	public dispatchPhysicalDelete(job: StorageDeleteJob): Promise<void> {
		this.deletes.push(job);
		return Promise.resolve();
	}

	public dispatchCdnInvalidation(job: StorageCdnInvalidationJob): Promise<void> {
		this.cdnInvalidations.push(job);
		return Promise.resolve();
	}
}

function setup(
	overrides: Parameters<typeof storedFile>[0],
	bytes: Buffer = PDF_BYTES,
	processor: FakeImageProcessor = new FakeImageProcessor(),
): { service: FileService; repository: InMemoryStoredFileRepository; dispatcher: RecordingDispatcher; storage: InMemoryObjectStorage } {
	const config = createTestTypedConfig({ STORAGE_PROVIDER: "local" });
	const repository = new InMemoryStoredFileRepository(storedFile({ status: "PENDING", scanStatus: null, expectedChecksum: CHECKSUM, sizeBytes: bytes.length, ...overrides }));
	const storage = new InMemoryObjectStorage();
	storage.put({ container: CONTAINER, path: STAGING_PATH }, bytes);
	const dispatcher = new RecordingDispatcher();
	const service = new FileService(
		config,
		repository,
		new FileFinalizationService(config, repository, storage, storage, new ImmediateTransactions(), listenerRegistry(), imageRenditionsFor(config, storage, processor)),
		dispatcher,
		storage,
		storage,
		imageRenditionsFor(config, storage, processor),
	);
	return { service, repository, dispatcher, storage };
}

describe("FileService.completeUpload", () => {
	it("verifies the bytes (streamed checksum), claims SCANNING and dispatches the scan — it never marks the file CLEAN itself", async () => {
		const { service, repository, dispatcher, storage } = setup({});

		const result = await service.completeUpload(UPLOADER_ID, FILE_ID, { checksumSha256: CHECKSUM });

		expect(result.file.status).toBe("SCANNING");
		expect(repository.rows.get(FILE_ID)).toMatchObject({ status: "SCANNING", scanStatus: "SCANNING", actualChecksum: CHECKSUM });
		expect(dispatcher.scans).toEqual([FILE_ID]);
		expect(storage.streamed.length).toBeGreaterThan(0);
	});

	it("rejects content whose magic bytes do not match the declared type, before claiming", async () => {
		const html = Buffer.from("<html><script>alert(1)</script></html>");
		const { service, repository, dispatcher } = setup({ expectedChecksum: createHash("sha256").update(html).digest("hex") }, html);

		await expect(service.completeUpload(UPLOADER_ID, FILE_ID, { checksumSha256: createHash("sha256").update(html).digest("hex") })).rejects.toBeInstanceOf(
			BadRequestException,
		);
		expect(repository.rows.get(FILE_ID)?.status).toBe("PENDING");
		expect(dispatcher.scans).toEqual([]);
	});

	it("rejects a checksum that does not match the stored bytes", async () => {
		const { service, dispatcher } = setup({ expectedChecksum: "f".repeat(64) });

		await expect(service.completeUpload(UPLOADER_ID, FILE_ID, { checksumSha256: "f".repeat(64) })).rejects.toBeInstanceOf(BadRequestException);
		expect(dispatcher.scans).toEqual([]);
	});

	it("lets exactly one of two concurrent completions win; the loser gets 409 and nothing is dispatched twice", async () => {
		const { service, dispatcher } = setup({});

		const results = await Promise.allSettled([
			service.completeUpload(UPLOADER_ID, FILE_ID, { checksumSha256: CHECKSUM }),
			service.completeUpload(UPLOADER_ID, FILE_ID, { checksumSha256: CHECKSUM }),
		]);

		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		const rejected = results.find((result) => result.status === "rejected");
		expect(rejected?.status === "rejected" ? rejected.reason : null).toBeInstanceOf(ConflictException);
		expect(dispatcher.scans).toEqual([FILE_ID]);
	});
});

describe("FileService.completeUpload of an image with pixel rules (REWARD_IMAGE: 16:9, at least 4K)", () => {
	/** The smallest bytes that pass the WebP magic-byte check (the fake processor decides the "decoded" size). */
	const WEBP_BYTES = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(16)]);
	const WEBP_CHECKSUM = createHash("sha256").update(WEBP_BYTES).digest("hex");

	function imageSetup(processor: FakeImageProcessor): ReturnType<typeof setup> {
		return setup(
			{ category: "REWARD_IMAGE", visibility: "PUBLIC", mimeType: "image/webp", originalName: "kuih.webp", expectedChecksum: WEBP_CHECKSUM, organizationId: ORG_ID },
			WEBP_BYTES,
			processor,
		);
	}

	it("decodes the stored image, records its size and claims it for scanning when it meets the rules", async () => {
		const { service, repository, dispatcher } = imageSetup(new FakeImageProcessor());

		await service.completeUpload(UPLOADER_ID, FILE_ID, { checksumSha256: WEBP_CHECKSUM });

		expect(repository.rows.get(FILE_ID)).toMatchObject({ status: "SCANNING", imageWidth: 3840, imageHeight: 2160 });
		expect(dispatcher.scans).toEqual([FILE_ID]);
	});

	it.each([
		{ size: { width: 4032, height: 3024 }, message: "Images must be 16:9 (landscape)." },
		{ size: { width: 1280, height: 720 }, message: "Images must be at least 1920 × 1080 pixels so they stay sharp on every screen." },
	])("refuses a $size.width×$size.height image before claiming it, saying why", async ({ size, message }) => {
		const processor = new FakeImageProcessor();
		processor.dimensions = size;
		const { service, repository, dispatcher } = imageSetup(processor);

		await expect(service.completeUpload(UPLOADER_ID, FILE_ID, { checksumSha256: WEBP_CHECKSUM })).rejects.toMatchObject({
			response: { error: "FILE_IMAGE_DIMENSIONS_INVALID", message },
		});
		expect(repository.rows.get(FILE_ID)?.status).toBe("PENDING");
		expect(dispatcher.scans).toEqual([]);
	});

	it("refuses bytes that do not decode as an image", async () => {
		const processor = new FakeImageProcessor();
		processor.unreadable = true;
		const { service, dispatcher } = imageSetup(processor);

		await expect(service.completeUpload(UPLOADER_ID, FILE_ID, { checksumSha256: WEBP_CHECKSUM })).rejects.toMatchObject({ response: { error: "FILE_IMAGE_UNREADABLE" } });
		expect(dispatcher.scans).toEqual([]);
	});

	it("never decodes a file whose category has no pixel rules", async () => {
		const processor = new FakeImageProcessor();
		processor.unreadable = true;
		const { service } = setup({}, PDF_BYTES, processor);

		await expect(service.completeUpload(UPLOADER_ID, FILE_ID, { checksumSha256: CHECKSUM })).resolves.toMatchObject({ file: { status: "SCANNING" } });
	});
});

describe("FileService.deleteStoredFile", () => {
	it("soft-deletes the file and its references as the acting user, then dispatches the physical delete", async () => {
		const { service, repository, dispatcher } = setup({ status: "READY" });

		await service.deleteStoredFile(storedFile({ status: "READY" }), UPLOADER_ID);

		expect(repository.softDeletedBy).toEqual([UPLOADER_ID]);
		expect(dispatcher.deletes).toEqual([{ fileId: FILE_ID, provider: "local", container: CONTAINER, path: STAGING_PATH }]);
	});

	it("withdraws a published public asset immediately, before the delayed physical delete of the private original", async () => {
		const publicFile = storedFile({ status: "READY", category: "PRODUCT_IMAGE", visibility: "PUBLIC", publicPath: `https://cdn.test/${FILE_ID}` });
		const { service, storage, dispatcher } = setup(publicFile);
		storage.published.add(FILE_ID);

		await service.deleteStoredFile(publicFile, UPLOADER_ID);

		expect(storage.unpublished).toEqual([FILE_ID]);
		expect(storage.published.has(FILE_ID)).toBe(false);
		expect(dispatcher.deletes).toHaveLength(1);
		expect(dispatcher.cdnInvalidations).toEqual([]);
	});

	it("hands the CDN purge of a withdrawn asset to the dispatcher (never runs it inside the request)", async () => {
		const publicFile = storedFile({ status: "READY", category: "PRODUCT_IMAGE", visibility: "PUBLIC", publicPath: `https://cdn.test/${FILE_ID}` });
		const { service, storage, dispatcher } = setup(publicFile);
		storage.servesThroughCdn = true;

		await service.deleteStoredFile(publicFile, UPLOADER_ID);

		expect(dispatcher.cdnInvalidations).toEqual([{ fileId: FILE_ID, objectKeys: [STAGING_PATH] }]);
	});

	it("withdraws nothing for a private file", async () => {
		const { service, storage } = setup({ status: "READY" });

		await service.deleteStoredFile(storedFile({ status: "READY" }), UPLOADER_ID);

		expect(storage.unpublished).toEqual([]);
	});

	it("retains KYB evidence that was submitted for review", async () => {
		const { service, repository, dispatcher } = setup({ status: "READY" });
		repository.kybSubmitted = true;

		await expect(service.deleteStoredFile(storedFile({ status: "READY" }), UPLOADER_ID)).rejects.toBeInstanceOf(ConflictException);
		expect(repository.rows.get(FILE_ID)?.isDeleted).toBe(false);
		expect(dispatcher.deletes).toEqual([]);
	});

	it("refuses to delete an image a live reward shows and keeps it published", async () => {
		const cover = storedFile({ status: "READY", category: "REWARD_IMAGE", visibility: "PUBLIC", publicPath: `https://cdn.test/${FILE_ID}` });
		const { service, repository, storage, dispatcher } = setup(cover);
		storage.published.add(FILE_ID);
		repository.rewardImageFileIds.add(FILE_ID);

		await expect(service.deleteStoredFile(cover, UPLOADER_ID)).rejects.toMatchObject({ response: { error: "FILE_IN_USE_AS_REWARD_IMAGE" } });
		expect(repository.rows.get(FILE_ID)?.isDeleted).toBe(false);
		expect(storage.published.has(FILE_ID)).toBe(true);
		expect(dispatcher.deletes).toEqual([]);
	});

	it("withdraws and deletes an image's renditions together with the image", async () => {
		const image = storedFile({ status: "READY", category: "REWARD_IMAGE", visibility: "PUBLIC", publicPath: `https://cdn.test/${FILE_ID}` });
		const { service, repository, storage, dispatcher } = setup(image);
		// The fake records rows in memory; the transaction client is not used.
		await repository.upsertVariantsInTx(createTestPrisma(), FILE_ID, [
			{
				kind: "THUMBNAIL",
				mimeType: "image/webp",
				sizeBytes: 10,
				width: 640,
				height: 360,
				storageProvider: "local",
				storageContainer: CONTAINER,
				storageBucket: CONTAINER,
				storagePath: `stores/${ORG_ID}/reward-images/thumbnail/${FILE_ID}.webp`,
				publicPath: `https://cdn.test/${FILE_ID}/thumbnail`,
				objectRevision: null,
				objectGeneration: null,
			},
		]);

		await service.deleteStoredFile(image, UPLOADER_ID);

		expect(storage.unpublished).toEqual([FILE_ID, FILE_ID]);
		expect(dispatcher.deletes.map((job) => job.path)).toEqual([STAGING_PATH, `stores/${ORG_ID}/reward-images/thumbnail/${FILE_ID}.webp`]);
	});

	it("reports a file that was already deleted as not found", async () => {
		const { service } = setup({ status: "DELETED", isDeleted: true });

		await expect(service.deleteStoredFile(storedFile({ status: "READY" }), UPLOADER_ID)).rejects.toMatchObject({ response: { error: "FILE_NOT_FOUND" } });
	});
});

describe("FileService.createDownloadUrl", () => {
	it.each<FileStatus>(["PENDING", "SCANNING", "QUARANTINED", "FAILED"])("issues no URL while the file is %s", async (status: FileStatus) => {
		const { service } = setup({ status });

		await expect(service.createDownloadUrl(storedFile({ status }))).resolves.toMatchObject({ downloadUrl: null, expiresAt: null });
	});
});

describe("FileService.createZipArchive", () => {
	const FIRST_PATH = "rewards/first.webp";
	const SECOND_PATH = "rewards/second.webp";

	async function collect(stream: Readable): Promise<Buffer> {
		const chunks: Buffer[] = [];
		for await (const chunk of stream) {
			chunks.push(streamChunkToBuffer(StreamChunkSchema.parse(chunk)));
		}
		return Buffer.concat(chunks);
	}

	it("archives the original uploads in the given order, numbered, under their sanitized names", async () => {
		const { service, storage } = setup({});
		storage.put({ container: CONTAINER, path: FIRST_PATH }, Buffer.from("first image"));
		storage.put({ container: CONTAINER, path: SECOND_PATH }, Buffer.from("second image"));
		const files = [
			storedFile({ id: "11111111-1111-4111-8111-111111111111", status: "READY", storagePath: FIRST_PATH, originalName: "Brunch table.webp" }),
			storedFile({ id: "22222222-2222-4222-8222-222222222222", status: "READY", storagePath: SECOND_PATH, originalName: "../plating.webp" }),
		];

		const entries = unzipSync(await collect(service.createZipArchive(files)));

		expect(Object.keys(entries)).toEqual(["1-Brunch table.webp", "2-plating.webp"]);
		expect(strFromU8(entries["1-Brunch table.webp"] ?? new Uint8Array())).toBe("first image");
		expect(strFromU8(entries["2-plating.webp"] ?? new Uint8Array())).toBe("second image");
	});

	it("fails the stream when an object is missing from storage", async () => {
		const { service } = setup({});

		await expect(collect(service.createZipArchive([storedFile({ status: "READY", storagePath: "rewards/missing.webp" })]))).rejects.toThrow(/is missing/);
	});
});
