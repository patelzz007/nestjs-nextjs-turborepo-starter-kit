import { epochMs, type CompleteFileUploadResponse, type FileStatus, type StoredObjectScanStatus } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FileProcessingError, FileWaitAbortedError, waitForFileReady, type FileStatusReader } from "../file-readiness";

const FILE_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";

interface FileDetailAnswer {
	readonly data: CompleteFileUploadResponse;
}

function fileDetail(status: FileStatus, scanStatus: StoredObjectScanStatus | null = null): FileDetailAnswer {
	return {
		data: {
			file: {
				id: FILE_ID,
				category: "MERCHANT_KYB",
				visibility: "PRIVATE",
				originalName: "doc.pdf",
				mimeType: "application/pdf",
				sizeBytes: 8,
				status,
				scanStatus,
				publicUrl: null,
				uploadedAt: epochMs(0),
			},
		},
	};
}

function readerAnswering(statuses: readonly FileStatus[]): FileStatusReader & { readonly calls: () => number } {
	let index = 0;
	return {
		calls: (): number => index,
		files: {
			detail: {
				fetchOrThrow: (): Promise<FileDetailAnswer> => {
					const status: FileStatus = statuses[Math.min(index, statuses.length - 1)] ?? "READY";
					index += 1;
					return Promise.resolve(fileDetail(status));
				},
			},
		},
	};
}

describe("waitForFileReady", () => {
	it("polls with backoff until the file is READY", async () => {
		const reader = readerAnswering(["SCANNING", "SCANNING", "READY"]);

		await expect(waitForFileReady(reader, FILE_ID, { initialDelayMs: 1, maxDelayMs: 2 })).resolves.toMatchObject({ file: { status: "READY" } });
		expect(reader.calls()).toBe(3);
	});

	it.each<FileStatus>(["QUARANTINED", "FAILED"])("rejects as soon as the file is %s", async (status: FileStatus) => {
		const wait = waitForFileReady(readerAnswering(["SCANNING", status]), FILE_ID, { initialDelayMs: 1 });

		await expect(wait).rejects.toBeInstanceOf(FileProcessingError);
		await expect(wait).rejects.toMatchObject({ kind: "rejected", status });
	});

	it("gives up with a timeout once the budget is spent", async () => {
		await expect(waitForFileReady(readerAnswering(["SCANNING"]), FILE_ID, { initialDelayMs: 1, maxDelayMs: 1, timeoutMs: 5 })).rejects.toMatchObject({ kind: "timeout" });
	});

	it("stops when the caller aborts", async () => {
		const controller = new AbortController();
		const wait = waitForFileReady(readerAnswering(["SCANNING"]), FILE_ID, { initialDelayMs: 10_000, signal: controller.signal });
		controller.abort(new Error("left the page"));

		await expect(wait).rejects.toThrow("left the page");
	});

	it("stops with an abort error when the caller aborts with a reason that is not an error", async () => {
		const controller = new AbortController();
		controller.abort("left the screen");

		await expect(waitForFileReady(readerAnswering(["SCANNING"]), FILE_ID, { initialDelayMs: 1, signal: controller.signal })).rejects.toBeInstanceOf(FileWaitAbortedError);
		await expect(waitForFileReady(readerAnswering(["SCANNING"]), FILE_ID, { initialDelayMs: 1, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
	});

	it("resolves READY even when the store has no scanner (NOT_SCANNED)", async () => {
		const reader: FileStatusReader = { files: { detail: { fetchOrThrow: (): Promise<FileDetailAnswer> => Promise.resolve(fileDetail("READY", "NOT_SCANNED")) } } };

		await expect(waitForFileReady(reader, FILE_ID)).resolves.toMatchObject({ file: { scanStatus: "NOT_SCANNED" } });
	});

	it("rejects an INFECTED verdict", async () => {
		const reader: FileStatusReader = {
			files: { detail: { fetchOrThrow: (): Promise<FileDetailAnswer> => Promise.resolve(fileDetail("PROCESSING", "INFECTED")) } },
		};

		await expect(waitForFileReady(reader, FILE_ID)).rejects.toMatchObject({ kind: "rejected" });
	});
});
