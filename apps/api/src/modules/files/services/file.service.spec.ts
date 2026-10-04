import { createHash } from "node:crypto";

import { BadRequestException, ConflictException } from "@nestjs/common";
import type { FileStatus, StorageCdnInvalidationJob, StorageDeleteJob } from "@workspace/shared";
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
} from "../../../../test/support/file-lifecycle-fakes";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
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
): { service: FileService; repository: InMemoryStoredFileRepository; dispatcher: RecordingDispatcher; storage: InMemoryObjectStorage } {
	const config = createTestTypedConfig({ STORAGE_PROVIDER: "local" });
	const repository = new InMemoryStoredFileRepository(storedFile({ status: "PENDING", scanStatus: null, expectedChecksum: CHECKSUM, sizeBytes: bytes.length, ...overrides }));
	const storage = new InMemoryObjectStorage();
	storage.put({ container: CONTAINER, path: STAGING_PATH }, bytes);
	const dispatcher = new RecordingDispatcher();
	const service = new FileService(
		config,
		repository,
		new FileFinalizationService(config, repository, storage, storage, new ImmediateTransactions(), listenerRegistry()),
		dispatcher,
		storage,
		storage,
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
});

describe("FileService.createDownloadUrl", () => {
	it.each<FileStatus>(["PENDING", "SCANNING", "QUARANTINED", "FAILED"])("issues no URL while the file is %s", async (status: FileStatus) => {
		const { service } = setup({ status });

		await expect(service.createDownloadUrl(storedFile({ status }))).resolves.toMatchObject({ downloadUrl: null, expiresAt: null });
	});
});
