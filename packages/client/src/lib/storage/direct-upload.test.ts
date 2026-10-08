import {
	LIST_SLOT_INDEX,
	epochMs,
	type CreateFileUploadUrlResponse,
	type Envelope,
	type FileDetailResponse,
	type FileStatus,
	type StoredObjectScanStatus,
} from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture } from "../../test/auth-fixtures";
import type { FetchImpl } from "../test-utils";
import { DirectUploadError, FileProcessingError, uploadFileWithTicket, waitForFileReady, type FileStatusReader } from "./direct-upload";

const FILE_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";

function postTicket(): CreateFileUploadUrlResponse {
	return {
		fileId: FILE_ID,
		objectPath: "tmp/kyb/doc.pdf",
		expiresIn: 300,
		method: "POST_MULTIPART",
		uploadUrl: "http://storage.test/upload",
		fields: { key: "tmp/kyb/doc.pdf", token: "signed-token" },
	};
}

function pdf(): File {
	return new File(["%PDF-1.7"], "doc.pdf", { type: "application/pdf" });
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("uploadFileWithTicket", () => {
	it("sends the ticket's fields in the API's order (key, token) and the file LAST", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);

		await uploadFileWithTicket(postTicket(), pdf());

		const body = fetchMock.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second]?.body;
		expect(body instanceof FormData ? [...body.keys()] : []).toEqual(["key", "token", "file"]);
	});

	it("treats an unreadable answer (CORS block / network failure) as a FAILED upload — never as success", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockRejectedValue(new TypeError("Failed to fetch")));

		const upload = uploadFileWithTicket(postTicket(), pdf());

		await expect(upload).rejects.toBeInstanceOf(DirectUploadError);
		await expect(upload).rejects.toMatchObject({ kind: "unreachable" });
	});

	it("reports a storage rejection with its status", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(new Response("policy expired", { status: 403 })));

		await expect(uploadFileWithTicket(postTicket(), pdf())).rejects.toMatchObject({ kind: "rejected", status: 403 });
	});

	it("PUTs the bytes with the signed headers for a PUT ticket", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await uploadFileWithTicket({ ...postTicket(), method: "PUT", fields: undefined, headers: { "Content-Type": "application/pdf" } }, pdf());

		expect(fetchMock.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second]).toMatchObject({ method: "PUT", headers: { "Content-Type": "application/pdf" } });
	});
});

function fileDetail(status: FileStatus, scanStatus: StoredObjectScanStatus | null = null): Envelope<FileDetailResponse> {
	return envelopeFixture({
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
	});
}

function readerAnswering(statuses: readonly FileStatus[]): FileStatusReader & { readonly calls: () => number } {
	let index = 0;
	return {
		calls: (): number => index,
		files: {
			detail: {
				fetchOrThrow: (): Promise<Envelope<FileDetailResponse>> => {
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

	it("resolves READY even when the store has no scanner (NOT_SCANNED)", async () => {
		const reader: FileStatusReader = { files: { detail: { fetchOrThrow: (): Promise<Envelope<FileDetailResponse>> => Promise.resolve(fileDetail("READY", "NOT_SCANNED")) } } };

		await expect(waitForFileReady(reader, FILE_ID)).resolves.toMatchObject({ file: { scanStatus: "NOT_SCANNED" } });
	});

	it("rejects an INFECTED verdict", async () => {
		const reader: FileStatusReader = {
			files: { detail: { fetchOrThrow: (): Promise<Envelope<FileDetailResponse>> => Promise.resolve(fileDetail("PROCESSING", "INFECTED")) } },
		};

		await expect(waitForFileReady(reader, FILE_ID)).rejects.toMatchObject({ kind: "rejected" });
	});
});
