import type { FileStatus } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { StoredFileAggregate, type StoredFileState, type VerdictRecord } from "../aggregates/stored-file.aggregate";
import { FileChecksumMismatchError, FileStateConflictError, FileUploadAlreadyCompletedError, FileUploadForbiddenError } from "../errors/files.errors";
import { FileDeleted } from "../events/file-deleted.event";
import { FileVerdictReached } from "../events/file-verdict-reached.event";
import { CHECKSUM, FILE_ID, FILE_STATUSES_FOR_TEST, NOW, ORG_ID, UPLOADER_ID, locator, state } from "./stored-file.fixtures";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

const VERIFIED = { actualChecksum: CHECKSUM, objectRevision: "rev", imageWidth: null, imageHeight: null };
const RECORD: VerdictRecord = { scanStatus: "CLEAN", scannedAt: NOW, scanResult: "scanner: OK", promoted: null, renditions: [] };

function load(overrides: Partial<StoredFileState> = {}): StoredFileAggregate {
	return StoredFileAggregate.rehydrate(state(overrides));
}

describe("StoredFileAggregate.request", () => {
	it("starts PENDING, unsaved, with the upload description as its change", () => {
		const file = StoredFileAggregate.request({
			id: FILE_ID,
			category: "MERCHANT_KYB",
			visibility: "PRIVATE",
			uploadedById: UPLOADER_ID,
			tenantId: ORG_ID,
			productId: null,
			expectedChecksum: CHECKSUM,
			original: { slot: "ORIGINAL", locator: locator("staging/kyb/x.pdf"), publicPath: null },
			upload: { originalName: "x.pdf", mimeType: "application/pdf", sizeBytes: 10, expectedChecksum: CHECKSUM },
		});

		expect(file.status).toBe("PENDING");
		expect(file.concurrencyToken).toBeNull();
		expect(file.pendingChange).toEqual({ kind: "requested", upload: { originalName: "x.pdf", mimeType: "application/pdf", sizeBytes: 10, expectedChecksum: CHECKSUM } });
		expect(file.pullEvents()).toEqual([]);
	});
});

describe("StoredFileAggregate.rehydrate", () => {
	it("keeps the loaded status as the concurrency token", () => {
		expect(load({ status: "SCANNING" }).concurrencyToken).toBe("SCANNING");
	});

	it("rejects a live row in DELETED and a deleted row in any other status (§spec-7.3)", () => {
		expect(() => load({ status: "DELETED", isDeleted: false })).toThrow(CorruptAggregateStateError);
		expect(() => load({ status: "READY", isDeleted: true })).toThrow(CorruptAggregateStateError);
	});
});

describe("StoredFileAggregate completion", () => {
	it("claims PENDING → SCANNING for the uploader with the verified facts", () => {
		const file = load();

		file.claimForScan(UPLOADER_ID, CHECKSUM, VERIFIED);

		expect(file.status).toBe("SCANNING");
		expect(file.pendingChange).toEqual({ kind: "claimed-for-scan", verified: VERIFIED });
	});

	it("refuses another user, a second completion and a different checksum", () => {
		expect(() => {
			load().claimForScan("someone-else", CHECKSUM, VERIFIED);
		}).toThrow(FileUploadForbiddenError);
		expect(() => {
			load({ status: "SCANNING" }).claimForScan(UPLOADER_ID, CHECKSUM, VERIFIED);
		}).toThrow(FileUploadAlreadyCompletedError);
		expect(() => {
			load().claimForScan(UPLOADER_ID, "b".repeat(64), VERIFIED);
		}).toThrow(FileChecksumMismatchError);
	});

	it.each(FILE_STATUSES_FOR_TEST.filter((status: FileStatus): boolean => status !== "PENDING" && status !== "DELETED"))(
		"refuses to complete a %s file",
		(status: FileStatus) => {
			expect(() => {
				load({ status }).assertCompletableBy(UPLOADER_ID, CHECKSUM);
			}).toThrow(FileUploadAlreadyCompletedError);
		},
	);
});

describe("StoredFileAggregate verdicts", () => {
	it.each<FileStatus>(["SCANNING", "PROCESSING"])("applies a verdict from %s and records FileVerdictReached exactly once", (status: FileStatus) => {
		const file = load({ status, productId: "product-1", category: "PRODUCT_IMAGE" });

		file.reachVerdict("READY", RECORD, NOW);

		expect(file.status).toBe("READY");
		const events = file.pullEvents();
		expect(events).toHaveLength(1);
		expect(events.at(0)).toBeInstanceOf(FileVerdictReached);
		expect(events.at(0)).toMatchObject({ fileId: FILE_ID, outcome: "READY", productId: "product-1", occurredAt: NOW });
		expect(file.pullEvents()).toEqual([]);
	});

	it.each(FILE_STATUSES_FOR_TEST.filter((status: FileStatus): boolean => status !== "SCANNING" && status !== "PROCESSING" && status !== "DELETED"))(
		"never moves a %s file (redelivered job, replayed callback)",
		(status: FileStatus) => {
			const file = load({ status });

			expect(() => {
				file.reachVerdict("READY", RECORD, NOW);
			}).toThrow(FileStateConflictError);
			expect(file.isAwaitingVerdict).toBe(false);
			expect(file.pullEvents()).toEqual([]);
		},
	);
});

describe("StoredFileAggregate.delete", () => {
	it("records FileDeleted with every stored copy and which ones are published", () => {
		const file = load({
			status: "READY",
			visibility: "PUBLIC",
			category: "REWARD_IMAGE",
			original: { slot: "ORIGINAL", locator: locator("stores/o/reward.webp"), publicPath: "https://cdn.test/f" },
			renditions: [{ slot: "THUMBNAIL", locator: locator("stores/o/thumbnail/f.webp"), publicPath: "https://cdn.test/f/thumbnail" }],
		});

		file.delete(UPLOADER_ID, NOW);

		expect(file.status).toBe("DELETED");
		expect(file.pendingChange).toEqual({ kind: "deleted", deletedBy: UPLOADER_ID, deletedAt: NOW });
		const [event] = file.pullEvents();
		expect(event).toBeInstanceOf(FileDeleted);
		expect(event).toMatchObject({
			fileId: FILE_ID,
			category: "REWARD_IMAGE",
			deletedBy: UPLOADER_ID,
			objects: [
				{ slot: "ORIGINAL", locator: locator("stores/o/reward.webp"), published: true },
				{ slot: "THUMBNAIL", locator: locator("stores/o/thumbnail/f.webp"), published: true },
			],
		});
	});

	it("never marks a private original as published", () => {
		const file = load({ status: "READY", original: { slot: "ORIGINAL", locator: locator("kyb/f.pdf"), publicPath: "leftover" } });

		file.delete(UPLOADER_ID, NOW);

		expect(file.pullEvents().at(0)).toMatchObject({ objects: [{ slot: "ORIGINAL", published: false }] });
	});
});
