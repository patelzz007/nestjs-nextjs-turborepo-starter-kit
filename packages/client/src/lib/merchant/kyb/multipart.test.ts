import { epochMs, type Envelope, type FileDetailResponse, type FileStatus } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { envelopeFixture } from "../../../test/auth-fixtures";
import { FileProcessingError, type DirectUploadResult, type FileStatusReader } from "../../storage/direct-upload";
import { awaitUploadedDocumentReady } from "./multipart";

const FILE_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";

function fileDetail(status: FileStatus): FileDetailResponse {
	return {
		file: {
			id: FILE_ID,
			category: "MERCHANT_KYB",
			visibility: "PRIVATE",
			originalName: "doc.pdf",
			mimeType: "application/pdf",
			sizeBytes: 8,
			status,
			scanStatus: null,
			publicUrl: null,
			uploadedAt: epochMs(0),
		},
	};
}

function uploaded(status: FileStatus): DirectUploadResult {
	return { fileId: FILE_ID, response: fileDetail(status) };
}

function readerAnswering(status: FileStatus): FileStatusReader & { readonly fetchOrThrow: ReturnType<typeof vi.fn> } {
	const fetchOrThrow = vi.fn((): Promise<Envelope<FileDetailResponse>> => Promise.resolve(envelopeFixture(fileDetail(status))));
	return { fetchOrThrow, files: { detail: { fetchOrThrow } } };
}

describe("awaitUploadedDocumentReady", () => {
	it("is done at once when the upload already answered READY", async () => {
		const reader = readerAnswering("READY");

		await awaitUploadedDocumentReady(reader, uploaded("READY"), undefined);

		expect(reader.fetchOrThrow).not.toHaveBeenCalled();
	});

	it("waits for a SCANNING upload to become READY before it counts as uploaded", async () => {
		const reader = readerAnswering("READY");

		await awaitUploadedDocumentReady(reader, uploaded("SCANNING"), undefined);

		expect(reader.fetchOrThrow).toHaveBeenCalledWith({ fileId: FILE_ID }, expect.anything());
	});

	it.each<FileStatus>(["QUARANTINED", "FAILED"])("rejects a %s document as an error", async (status: FileStatus) => {
		await expect(awaitUploadedDocumentReady(readerAnswering(status), uploaded("SCANNING"), undefined)).rejects.toBeInstanceOf(FileProcessingError);
	});
});
