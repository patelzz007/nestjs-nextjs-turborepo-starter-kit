import { BadRequestException, ConflictException } from "@nestjs/common";
import type { FileStatus } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import {
	FILE_ID,
	ImmediateTransactions,
	InMemoryObjectStorage,
	InMemoryStoredFileRepository,
	ORG_ID,
	PDF_BYTES,
	RecordingFileListener,
	UPLOADER_ID,
	listenerRegistry,
	storedFile,
} from "../../../../test/support/file-lifecycle-fakes";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { FileFinalizationService } from "./file-finalization.service";

const CONTAINER = "local-private-bucket";
const STAGING_PATH = `staging/kyb/${ORG_ID}/${FILE_ID}-licence.pdf`;
const FINAL_PATH = `kyb/${ORG_ID}/${FILE_ID}.pdf`;
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

interface Fixture {
	readonly service: FileFinalizationService;
	readonly repository: InMemoryStoredFileRepository;
	readonly storage: InMemoryObjectStorage;
	readonly transactions: ImmediateTransactions;
	readonly kybListener: RecordingFileListener;
}

function setup(...files: Parameters<typeof storedFile>[0][]): Fixture {
	const repository = new InMemoryStoredFileRepository(...files.map((overrides) => storedFile(overrides)));
	const storage = new InMemoryObjectStorage();
	storage.put({ container: CONTAINER, path: STAGING_PATH }, PDF_BYTES);
	const transactions = new ImmediateTransactions();
	const kybListener = new RecordingFileListener(["MERCHANT_KYB"]);
	const service = new FileFinalizationService(createTestTypedConfig({ STORAGE_PROVIDER: "local" }), repository, storage, storage, transactions, listenerRegistry(kybListener));
	return { service, repository, storage, transactions, kybListener };
}

describe("FileFinalizationService.applyScanResult", () => {
	it("NOT_SCANNED (MALWARE_SCANNER=none): READY but recorded NOT_SCANNED — never CLEAN", async () => {
		const { service, repository, kybListener } = setup({});

		await expect(service.applyScanResult(storedFile(), { outcome: "NOT_SCANNED", engine: "none", reason: "no malware scanner is configured" })).resolves.toBe("READY");

		expect(repository.rows.get(FILE_ID)).toMatchObject({ status: "READY", scanStatus: "NOT_SCANNED", scanResult: "none: no malware scanner is configured" });
		expect(kybListener.received.map((event) => event.outcome)).toEqual(["READY"]);
	});

	it("PENDING_EXTERNAL: leaves the file SCANNING for the asynchronous scanner's callback", async () => {
		const { service, repository, kybListener } = setup({});

		await expect(service.applyScanResult(storedFile(), { outcome: "PENDING_EXTERNAL", engine: "guardduty" })).resolves.toBe("AWAITING_EXTERNAL");

		expect(repository.rows.get(FILE_ID)?.status).toBe("SCANNING");
		expect(kybListener.received).toEqual([]);
	});

	it("CLEAN: promotes the bytes to the final key, records the scanner, and marks READY", async () => {
		const { service, repository, storage } = setup({});

		await expect(service.applyScanResult(storedFile(), { outcome: "CLEAN", engine: "scanner", detail: "OK" })).resolves.toBe("READY");

		expect(repository.rows.get(FILE_ID)).toMatchObject({ status: "READY", scanStatus: "CLEAN", scanResult: "scanner: OK", storagePath: FINAL_PATH });
		expect(storage.has(CONTAINER, FINAL_PATH)).toBe(true);
		expect(storage.has(CONTAINER, STAGING_PATH)).toBe(false);
	});

	it("INFECTED: quarantines and removes the infected bytes — never READY", async () => {
		const { service, repository, storage } = setup({});

		await expect(service.applyScanResult(storedFile(), { outcome: "INFECTED", engine: "scanner", signature: "Eicar-Signature" })).resolves.toBe("QUARANTINED");

		expect(repository.rows.get(FILE_ID)).toMatchObject({ status: "QUARANTINED", scanStatus: "INFECTED", scanResult: "scanner: Eicar-Signature" });
		expect(storage.has(CONTAINER, STAGING_PATH)).toBe(false);
	});

	it.each<FileStatus>(["DELETED", "QUARANTINED", "READY", "FAILED", "PENDING"])("never moves a %s file (redelivered job / raced delete)", async (status: FileStatus) => {
		const { service, repository } = setup({ status, isDeleted: status === "DELETED" });

		await expect(service.applyScanResult(storedFile({ status }), { outcome: "CLEAN", engine: "scanner", detail: "OK" })).resolves.toBe("SKIPPED");

		expect(repository.rows.get(FILE_ID)?.status).toBe(status);
	});

	it("drops its promoted copy when the file was deleted while the scan ran", async () => {
		const { service, repository, storage } = setup({});
		const snapshot = storedFile();
		await repository.softDeleteWithReferences(FILE_ID, UPLOADER_ID);

		await expect(service.applyScanResult(snapshot, { outcome: "CLEAN", engine: "scanner", detail: "OK" })).resolves.toBe("SKIPPED");

		expect(storage.has(CONTAINER, FINAL_PATH)).toBe(false);
	});

	it("binds a product image to the product persisted on the file — never one parsed from the object key", async () => {
		const productPath = `staging/products/${PRODUCT_ID}/original/${FILE_ID}-a.png`;
		const { service, repository, storage } = setup({
			category: "PRODUCT_IMAGE",
			visibility: "PUBLIC",
			productId: PRODUCT_ID,
			organizationId: null,
			storagePath: productPath,
			mimeType: "image/png",
		});
		storage.put({ container: CONTAINER, path: productPath }, PDF_BYTES);

		await service.applyScanResult(repository.rows.get(FILE_ID) ?? storedFile(), { outcome: "CLEAN", engine: "scanner", detail: "OK" });

		expect(repository.bindings).toEqual([{ kind: "PRODUCT_IMAGE", productId: PRODUCT_ID }]);
		expect(repository.rows.get(FILE_ID)?.publicPath).toBe(`https://cdn.test/${FILE_ID}`);
	});

	it("withdraws the public copy and the promoted object when the READY transition loses a race with a delete", async () => {
		const productPath = `staging/products/${PRODUCT_ID}/original/${FILE_ID}-a.png`;
		const finalProductPath = `products/${PRODUCT_ID}/original/${FILE_ID}.png`;
		const scanning = storedFile({ category: "PRODUCT_IMAGE", visibility: "PUBLIC", productId: PRODUCT_ID, storagePath: productPath, mimeType: "image/png" });
		const { service, repository, storage } = setup({ ...scanning, status: "DELETED" });
		storage.put({ container: CONTAINER, path: productPath }, PDF_BYTES);

		await expect(service.applyScanResult(scanning, { outcome: "CLEAN", engine: "scanner", detail: "OK" })).resolves.toBe("SKIPPED");

		expect(storage.published.has(FILE_ID)).toBe(false);
		expect(storage.unpublished).toEqual([FILE_ID]);
		expect(storage.has(CONTAINER, finalProductPath)).toBe(false);
		expect(repository.rows.get(FILE_ID)?.status).toBe("DELETED");
	});

	it("fails (never READY) a product image without a product binding", async () => {
		const { service, repository } = setup({ category: "PRODUCT_IMAGE", visibility: "PUBLIC", productId: null });

		await expect(service.applyScanResult(storedFile({ category: "PRODUCT_IMAGE", productId: null }), { outcome: "CLEAN", engine: "scanner", detail: "OK" })).resolves.toBe(
			"FAILED",
		);
		expect(repository.rows.get(FILE_ID)?.status).toBe("FAILED");
	});
});

describe("FileFinalizationService.applyProcessingResult (external worker callback)", () => {
	it("rejects READY without an explicit CLEAN scan status", async () => {
		const { service, repository } = setup({});

		await expect(service.applyProcessingResult({ fileId: FILE_ID, status: "READY" })).rejects.toBeInstanceOf(BadRequestException);
		expect(repository.rows.get(FILE_ID)?.status).toBe("SCANNING");
	});

	it("rejects a final path other than the file's own final key", async () => {
		const { service } = setup({});

		await expect(
			service.applyProcessingResult({ fileId: FILE_ID, status: "READY", scanStatus: "CLEAN", finalStoragePath: "kyb/other-org/stolen.pdf" }),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("applies a result once; a replay of the same callback is a 409", async () => {
		const { service, repository } = setup({});
		const result = { fileId: FILE_ID, status: "READY", scanStatus: "CLEAN" } satisfies Parameters<FileFinalizationService["applyProcessingResult"]>[0];

		await service.applyProcessingResult(result);
		await expect(service.applyProcessingResult(result)).rejects.toBeInstanceOf(ConflictException);
		expect(repository.rows.get(FILE_ID)?.status).toBe("READY");
	});

	it.each<FileStatus>(["QUARANTINED", "DELETED"])("cannot resurrect a %s file", async (status: FileStatus) => {
		const { service, repository } = setup({ status, isDeleted: false });

		await expect(service.applyProcessingResult({ fileId: FILE_ID, status: "READY", scanStatus: "CLEAN" })).rejects.toBeInstanceOf(ConflictException);
		expect(repository.rows.get(FILE_ID)?.status).toBe(status);
	});
});

describe("FileFinalizationService.failScan", () => {
	let fixture: ReturnType<typeof setup>;

	beforeEach(() => {
		fixture = setup({});
	});

	it("marks the upload FAILED with the reason and removes the staging bytes", async () => {
		await expect(fixture.service.failScan(storedFile(), "scanner unavailable")).resolves.toBe("FAILED");
		expect(fixture.repository.rows.get(FILE_ID)).toMatchObject({ status: "FAILED", scanResult: "scanner unavailable" });
		expect(fixture.storage.has(CONTAINER, STAGING_PATH)).toBe(false);
	});
});

describe("FileFinalizationService verdict events", () => {
	const event = { fileId: FILE_ID, category: "MERCHANT_KYB", organizationId: ORG_ID, uploadedById: UPLOADER_ID };

	it.each<[string, Parameters<FileFinalizationService["applyScanResult"]>[1], "READY" | "QUARANTINED"]>([
		["CLEAN", { outcome: "CLEAN", engine: "scanner", detail: "OK" }, "READY"],
		["INFECTED", { outcome: "INFECTED", engine: "scanner", signature: "Eicar" }, "QUARANTINED"],
	])("publishes the %s verdict to the category's listeners inside the files.scan_verdict.apply transaction", async (_label, verdict, outcome) => {
		const { service, transactions, kybListener } = setup({});

		await service.applyScanResult(storedFile(), verdict);

		expect(kybListener.received).toEqual([{ ...event, outcome }]);
		expect(transactions.operations).toEqual(["files.scan_verdict.apply"]);
	});

	it("publishes FAILED when no verdict could be obtained", async () => {
		const { service, kybListener } = setup({});

		await service.failScan(storedFile(), "scanner unavailable");

		expect(kybListener.received).toEqual([{ ...event, outcome: "FAILED" }]);
	});

	it("publishes nothing for a verdict that was not applied (file already decided)", async () => {
		const { service, kybListener } = setup({ status: "READY" });

		await service.applyScanResult(storedFile({ status: "READY" }), { outcome: "INFECTED", engine: "scanner", signature: "Eicar" });

		expect(kybListener.received).toEqual([]);
	});

	it("does not deliver other categories' verdicts to the KYB listener", async () => {
		const productPath = `staging/products/${PRODUCT_ID}/original/${FILE_ID}-a.png`;
		const { service, storage, kybListener } = setup({
			category: "PRODUCT_IMAGE",
			visibility: "PUBLIC",
			productId: PRODUCT_ID,
			storagePath: productPath,
			mimeType: "image/png",
		});
		storage.put({ container: CONTAINER, path: productPath }, PDF_BYTES);

		await service.applyScanResult(storedFile({ category: "PRODUCT_IMAGE", productId: PRODUCT_ID, storagePath: productPath, mimeType: "image/png" }), {
			outcome: "CLEAN",
			engine: "scanner",
			detail: "OK",
		});

		expect(kybListener.received).toEqual([]);
	});
});
