import type { StoredFile } from "@prisma/client";
import { epochMs, type EpochMs, type FileStatus } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import type { DomainEvent } from "../../../../platform/domain/domain-event";
import { bindInTransactionHandler, type InTransactionEventHandler } from "../../../../platform/application/events/in-transaction-event-handler";
import { UnreadableImageError, type RenderedImage } from "../../../../platform/infrastructure/storage/domain/image-processor.port";
import { MalwareScannerUnavailableError, type MalwareScanner, type MalwareScanResult } from "../../../../platform/infrastructure/storage/domain/malware-scanner.port";
import {
	FakeImageProcessor,
	FILE_ID,
	InMemoryObjectStorage,
	ORG_ID,
	PDF_BYTES,
	UPLOADER_ID,
	imageRenditionsFor,
	storedFile,
} from "../../../../../test/support/file-lifecycle-fakes";
import { FileBindingTargetMissingError } from "../../domain/errors/files.errors";
import { FileVerdictReached } from "../../domain/events/file-verdict-reached.event";
import { FileProcessingAdapter } from "../adapters/file-processing.adapter";
import { FilesUnitOfWorkHarness, InMemoryStoredFileRows, rowReader, scanActor, type FakeTransaction } from "./fakes/file-rows.fakes";

const CONTAINER = "local-private-bucket";
const STAGING_PATH = `staging/kyb/${ORG_ID}/${FILE_ID}-licence.pdf`;
const FINAL_PATH = `kyb/${ORG_ID}/${FILE_ID}.pdf`;
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const NOW: EpochMs = epochMs(1_800_000_000_000);

/** Answers every scan with a fixed result (or the scanner is down). */
class FixedScanner implements MalwareScanner {
	public readonly engine = "scanner";

	public constructor(private readonly result: MalwareScanResult | Error) {}

	public scan(): Promise<MalwareScanResult> {
		return this.result instanceof Error ? Promise.reject(this.result) : Promise.resolve(this.result);
	}
}

/** A real owner reaction registered on the dispatcher's in-transaction registry: records every verdict of its category. */
class RecordingVerdictHandler implements InTransactionEventHandler<FileVerdictReached, FakeTransaction> {
	public readonly received: FileVerdictReached[] = [];
	public readonly transactions: number[] = [];

	public constructor(
		private readonly category: StoredFile["category"],
		private readonly failure: Error | null = null,
		/** Only this outcome when set (a binding owner reacts to READY only). */
		private readonly outcome: FileVerdictReached["outcome"] | null = null,
	) {}

	public accepts(event: DomainEvent): event is FileVerdictReached {
		return event instanceof FileVerdictReached && event.category === this.category && (this.outcome === null || event.outcome === this.outcome);
	}

	public handle(event: FileVerdictReached, db: FakeTransaction): Promise<void> {
		this.received.push(event);
		this.transactions.push(db.id);
		return this.failure === null ? Promise.resolve() : Promise.reject(this.failure);
	}
}

interface Fixture {
	readonly adapter: FileProcessingAdapter;
	readonly rows: InMemoryStoredFileRows;
	readonly storage: InMemoryObjectStorage;
	readonly harness: FilesUnitOfWorkHarness;
	readonly kyb: RecordingVerdictHandler;
}

function setup(
	file: Partial<StoredFile> = {},
	scanner: MalwareScanner = new FixedScanner({ outcome: "CLEAN", engine: "scanner", detail: "OK" }),
	processor = new FakeImageProcessor(),
): Fixture {
	const rows = new InMemoryStoredFileRows(storedFile(file));
	const storage = new InMemoryObjectStorage();
	storage.put({ container: CONTAINER, path: file.storagePath ?? STAGING_PATH }, PDF_BYTES);
	const harness = new FilesUnitOfWorkHarness(rows);
	const kyb = new RecordingVerdictHandler("MERCHANT_KYB");
	harness.handlers.register(bindInTransactionHandler(kyb, { create: (db: FakeTransaction): FakeTransaction => db }));
	const adapter = new FileProcessingAdapter({
		uow: harness.uow,
		rows: rowReader(rows),
		storage,
		publicDelivery: storage,
		scanner,
		renditions: imageRenditionsFor(storage, processor),
		clock: new FixedClock(NOW),
	});
	return { adapter, rows, storage, harness, kyb };
}

describe("FileProcessingAdapter.scan", () => {
	it("NOT_SCANNED (MALWARE_SCANNER=none): READY but recorded NOT_SCANNED — never CLEAN", async () => {
		const { adapter, rows } = setup({}, new FixedScanner({ outcome: "NOT_SCANNED", engine: "none", reason: "no malware scanner is configured" }));

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("READY");
		expect(rows.row(FILE_ID)).toMatchObject({ status: "READY", scanStatus: "NOT_SCANNED", scanResult: "none: no malware scanner is configured" });
	});

	it("CLEAN: promotes the bytes to the final key, records the scanner and marks READY", async () => {
		const { adapter, rows, storage } = setup();

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("READY");
		expect(rows.row(FILE_ID)).toMatchObject({ status: "READY", scanStatus: "CLEAN", scanResult: "scanner: OK", storagePath: FINAL_PATH });
		expect(storage.has(CONTAINER, FINAL_PATH)).toBe(true);
		expect(storage.has(CONTAINER, STAGING_PATH)).toBe(false);
	});

	it("INFECTED: quarantines and removes the infected bytes — never READY", async () => {
		const { adapter, rows, storage } = setup({}, new FixedScanner({ outcome: "INFECTED", engine: "scanner", signature: "Eicar-Signature" }));

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("QUARANTINED");
		expect(rows.row(FILE_ID)).toMatchObject({ status: "QUARANTINED", scanStatus: "INFECTED", scanResult: "scanner: Eicar-Signature" });
		expect(storage.has(CONTAINER, STAGING_PATH)).toBe(false);
	});

	it("PENDING_EXTERNAL: leaves the file SCANNING for the asynchronous scanner's callback", async () => {
		const { adapter, rows, kyb } = setup({}, new FixedScanner({ outcome: "PENDING_EXTERNAL", engine: "guardduty" }));

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("AWAITING_EXTERNAL");
		expect(rows.row(FILE_ID)?.status).toBe("SCANNING");
		expect(kyb.received).toEqual([]);
	});

	it.each<FileStatus>(["QUARANTINED", "READY", "FAILED", "PENDING"])("never moves a %s file (redelivered job)", async (status: FileStatus) => {
		const { adapter, rows } = setup({ status });

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("SKIPPED");
		expect(rows.row(FILE_ID)?.status).toBe(status);
	});

	it("fails the upload when the object is missing", async () => {
		const { adapter, rows, storage } = setup();
		await storage.deleteObject({ provider: "local", container: CONTAINER, path: STAGING_PATH });

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("FAILED");
		expect(rows.row(FILE_ID)).toMatchObject({ status: "FAILED", scanResult: "uploaded object is missing" });
	});

	it("rethrows a scanner outage for a retry, and fails the upload on the final attempt — never CLEAN", async () => {
		const down = new MalwareScannerUnavailableError("scanner", "timeout");
		const retried = setup({}, new FixedScanner(down));
		await expect(retried.adapter.scan(scanActor(), FILE_ID, false)).rejects.toBe(down);
		expect(retried.rows.row(FILE_ID)?.status).toBe("SCANNING");

		const final = setup({}, new FixedScanner(down));
		await expect(final.adapter.scan(scanActor(), FILE_ID, true)).resolves.toBe("FAILED");
		expect(final.rows.row(FILE_ID)?.scanResult).toContain("scan failed: Malware scanner scanner unavailable: timeout");
	});

	it("fails (never READY) a product image without a product", async () => {
		const { adapter, rows } = setup({ category: "PRODUCT_IMAGE", visibility: "PUBLIC", productId: null, tenantId: null });

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("FAILED");
		expect(rows.row(FILE_ID)?.status).toBe("FAILED");
	});
});

describe("FileProcessingAdapter verdict transaction", () => {
	it("drains FileVerdictReached through the dispatcher to a registered handler, inside the verdict transaction, and publishes it after commit", async () => {
		const { adapter, harness, kyb } = setup();

		await adapter.scan(scanActor(), FILE_ID, false);

		expect(kyb.received.map((event) => [event.fileId, event.outcome, event.tenantId, event.uploadedById])).toEqual([[FILE_ID, "READY", ORG_ID, UPLOADER_ID]]);
		expect(kyb.transactions).toHaveLength(1);
		expect(harness.runner.scopes.at(-1)?.reason).toBe("Malware-scan a file in a test");
		expect(harness.publisher.published).toEqual(kyb.received);
	});

	it("rolls the verdict back with an owner's failing reaction (and publishes nothing)", async () => {
		const { adapter, rows, harness } = setup();
		harness.handlers.register(bindInTransactionHandler(new RecordingVerdictHandler("MERCHANT_KYB", new Error("reaction failed")), { create: (db: FakeTransaction) => db }));

		await expect(adapter.scan(scanActor(), FILE_ID, false)).rejects.toThrow("reaction failed");
		expect(rows.row(FILE_ID)?.status).toBe("SCANNING");
		expect(harness.runner.rolledBack).toBe(1);
		expect(harness.publisher.published).toEqual([]);
	});

	it("fails the upload instead when an owner cannot bind the READY file (a product removed mid-scan)", async () => {
		const productPath = `staging/products/${PRODUCT_ID}/original/${FILE_ID}-a.png`;
		const { adapter, rows, storage, harness } = setup({
			category: "PRODUCT_IMAGE",
			visibility: "PUBLIC",
			productId: PRODUCT_ID,
			tenantId: null,
			storagePath: productPath,
			mimeType: "image/png",
		});
		harness.handlers.register(
			bindInTransactionHandler(new RecordingVerdictHandler("PRODUCT_IMAGE", new FileBindingTargetMissingError(FILE_ID, "PRODUCT_IMAGE"), "READY"), {
				create: (db: FakeTransaction) => db,
			}),
		);

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("FAILED");
		expect(rows.row(FILE_ID)?.status).toBe("FAILED");
		expect(storage.published.has(FILE_ID)).toBe(false);
	});

	it("drops its promoted copy when the file was deleted while the scan ran", async () => {
		const productPath = `staging/products/${PRODUCT_ID}/original/${FILE_ID}-a.png`;
		const finalProductPath = `products/${PRODUCT_ID}/original/${FILE_ID}.png`;
		const { adapter, rows, storage } = setup({
			category: "PRODUCT_IMAGE",
			visibility: "PUBLIC",
			productId: PRODUCT_ID,
			tenantId: null,
			storagePath: productPath,
			mimeType: "image/png",
		});
		const scanner: MalwareScanner = {
			engine: "scanner",
			scan: (): Promise<MalwareScanResult> => {
				rows.deleteBehindTheScan(FILE_ID);
				return Promise.resolve({ outcome: "CLEAN", engine: "scanner", detail: "OK" });
			},
		};
		const racing = new FileProcessingAdapter({
			uow: new FilesUnitOfWorkHarness(rows).uow,
			rows: rowReader(rows),
			storage,
			publicDelivery: storage,
			scanner,
			renditions: imageRenditionsFor(storage),
			clock: new FixedClock(NOW),
		});

		await expect(racing.scan(scanActor(), FILE_ID, false)).resolves.toBe("SKIPPED");
		expect(adapter).toBeDefined();
		expect(storage.published.has(FILE_ID)).toBe(false);
		expect(storage.unpublished).toEqual([FILE_ID]);
		expect(storage.has(CONTAINER, finalProductPath)).toBe(false);
		expect(rows.row(FILE_ID)?.status).toBe("DELETED");
	});
});

describe("FileProcessingAdapter.applyProcessingResult (external worker callback)", () => {
	it("rejects READY without an explicit CLEAN scan status, and a final path other than the file's own", async () => {
		const { adapter, rows } = setup();

		await expect(adapter.applyProcessingResult(scanActor(), { fileId: FILE_ID, status: "READY" })).rejects.toMatchObject({ code: "FILE_SCAN_STATUS_REQUIRED" });
		await expect(
			adapter.applyProcessingResult(scanActor(), { fileId: FILE_ID, status: "READY", scanStatus: "CLEAN", finalStoragePath: "kyb/other/stolen.pdf" }),
		).rejects.toMatchObject({
			code: "FILE_FINAL_PATH_MISMATCH",
		});
		expect(rows.row(FILE_ID)?.status).toBe("SCANNING");
	});

	it("applies a result once; a replay of the same callback is a 409", async () => {
		const { adapter, rows } = setup();

		await adapter.applyProcessingResult(scanActor(), { fileId: FILE_ID, status: "READY", scanStatus: "CLEAN" });
		await expect(adapter.applyProcessingResult(scanActor(), { fileId: FILE_ID, status: "READY", scanStatus: "CLEAN" })).rejects.toMatchObject({ code: "FILE_STATE_CONFLICT" });
		expect(rows.row(FILE_ID)?.status).toBe("READY");
	});

	it("is not found for an unknown file and cannot resurrect a QUARANTINED one", async () => {
		await expect(
			setup({ isDeleted: true, status: "DELETED" }).adapter.applyProcessingResult(scanActor(), { fileId: FILE_ID, status: "READY", scanStatus: "CLEAN" }),
		).rejects.toMatchObject({
			code: "FILE_NOT_FOUND",
		});
		const quarantined = setup({ status: "QUARANTINED" });
		await expect(quarantined.adapter.applyProcessingResult(scanActor(), { fileId: FILE_ID, status: "READY", scanStatus: "CLEAN" })).rejects.toMatchObject({
			code: "FILE_STATE_CONFLICT",
		});
		expect(quarantined.rows.row(FILE_ID)?.status).toBe("QUARANTINED");
	});
});

describe("FileProcessingAdapter renditions of an image with pixel rules (REWARD_IMAGE)", () => {
	const IMAGE_STAGING_PATH = `staging/stores/${ORG_ID}/reward-images/${FILE_ID}-kuih.webp`;
	const image: Partial<StoredFile> = { category: "REWARD_IMAGE", visibility: "PUBLIC", mimeType: "image/webp", originalName: "kuih.webp", storagePath: IMAGE_STAGING_PATH };
	const notScanned = new FixedScanner({ outcome: "NOT_SCANNED", engine: "none", reason: "no scanner" });

	it("renders, stores, publishes and records every rendition (exact 16:9 sizes) in the READY transaction", async () => {
		const processor = new FakeImageProcessor();
		const { adapter, rows, storage } = setup(image, notScanned, processor);

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("READY");
		expect(processor.rendered.map((size) => size.width)).toEqual([640, 1280, 1920, 2560, 3840]);
		expect(rows.variants.map((variant) => [variant.kind, variant.width, variant.height, variant.mimeType])).toEqual([
			["THUMBNAIL", 640, 360, "image/webp"],
			["MEDIUM", 1280, 720, "image/webp"],
			["LARGE", 1920, 1080, "image/webp"],
			["XLARGE", 2560, 1440, "image/webp"],
			["UHD", 3840, 2160, "image/webp"],
		]);
		expect(storage.has(CONTAINER, `stores/${ORG_ID}/reward-images/uhd/${FILE_ID}.webp`)).toBe(true);
	});

	it("fails the upload (never READY, no renditions) when the image cannot be rendered", async () => {
		const { adapter, rows } = setup(image, notScanned, new FailingRenderProcessor());

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("FAILED");
		expect(rows.variants).toEqual([]);
	});

	it("keeps the staging bytes through a crash mid-promotion, undoes its own copies, and succeeds on the retry", async () => {
		const { adapter, rows, storage } = setup(image, notScanned, new CrashOnceProcessor());
		const finalPath = `stores/${ORG_ID}/reward-images/${FILE_ID}.webp`;

		await expect(adapter.scan(scanActor(), FILE_ID, false)).rejects.toThrow("renderer crashed");
		expect(rows.row(FILE_ID)).toMatchObject({ status: "SCANNING", storagePath: IMAGE_STAGING_PATH });
		expect(storage.has(CONTAINER, IMAGE_STAGING_PATH)).toBe(true);
		expect(storage.has(CONTAINER, finalPath)).toBe(false);
		expect(storage.published.has(FILE_ID)).toBe(false);

		await expect(adapter.scan(scanActor(), FILE_ID, false)).resolves.toBe("READY");
		expect(rows.row(FILE_ID)).toMatchObject({ status: "READY", storagePath: finalPath });
		expect(storage.has(CONTAINER, IMAGE_STAGING_PATH)).toBe(false);
	});
});

/** The first render crashes as a programming error would (not an unreadable image); every later one works. */
class CrashOnceProcessor extends FakeImageProcessor {
	private crashed = false;

	public override render(bytes: Buffer, width: number, height: number): Promise<RenderedImage> {
		if (!this.crashed) {
			this.crashed = true;
			return Promise.reject(new TypeError("renderer crashed"));
		}
		return super.render(bytes, width, height);
	}
}

/** Decodes, but every render fails — a corrupt image that slipped past the header check. */
class FailingRenderProcessor extends FakeImageProcessor {
	public override render(): Promise<RenderedImage> {
		return Promise.reject(new UnreadableImageError({ cause: new Error("corrupt") }));
	}
}
