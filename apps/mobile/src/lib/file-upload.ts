// ============================================
// lib/file-upload.ts - A file on the phone → object storage, ready to use
// ============================================
// The same flow as the web apps (docs/technical/storage/overview.md): the API
// issues an upload ticket (`POST /files/upload-url`), the bytes go straight
// to object storage with the ticket's method, the API verifies them
// (`POST /files/:id/complete`) and scans them, and the file is usable once
// READY (`waitForFileReady`, shared with the web apps). The bytes are read
// once, to send their size and SHA-256 with the ticket request; the native
// upload task streams the file itself, so a large photo is never copied
// through JavaScript.

import { waitForFileReady } from "@workspace/api-client";
import type { BrowserUploadMethod, CreateFileUploadUrlInput, CreateFileUploadUrlResponse, DocumentMimeType, FileRecord } from "@workspace/shared";
import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { File, UploadType, type UploadResult } from "expo-file-system";

import type { MobileApiClient } from "./api";

/** A file on the phone: where it is, what it is called and what it holds. */
export interface LocalFile {
	readonly uri: string;
	readonly name: string;
	readonly mimeType: DocumentMimeType;
}

/** The API calls an upload makes: the ticket, the check, and the reads that wait for READY. */
export interface FileUploadApi {
	readonly files: Pick<MobileApiClient["api"]["files"], "uploadUrl" | "complete" | "detail">;
}

/** What the upload is for — everything the ticket request needs except what is read from the bytes. */
export type FileUploadPurpose = Omit<CreateFileUploadUrlInput, "fileName" | "mimeType" | "sizeBytes" | "checksumSha256">;

/** Storage refused the bytes (a non-2xx answer), or could not be reached at all. */
export class FileUploadRejectedError extends Error {
	public readonly status: number | null;

	public constructor(status: number | null) {
		super(status === null ? "Storage could not be reached. Check your connection and try again." : `Storage refused the upload (HTTP ${String(status)}). Try again.`);
		this.name = "FileUploadRejectedError";
		this.status = status;
	}
}

/** First and last HTTP status codes of a success. */
const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 299;
/** Two hex digits per byte. */
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;

function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer), (byte: number): string => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0")).join("");
}

/** Sends the bytes the way the ticket's method says — exhaustive over the method enum, so a new method fails to compile until it is handled. */
function uploadWith(file: File, ticket: CreateFileUploadUrlResponse, mimeType: DocumentMimeType): Promise<UploadResult> {
	const method: BrowserUploadMethod = ticket.method;
	switch (method) {
		case "POST_MULTIPART":
			// Multipart form POST (S3 presigned POST, the API's local storage): the ticket's fields first, the file last.
			return file.upload(ticket.uploadUrl, { httpMethod: "POST", uploadType: UploadType.MULTIPART, fieldName: "file", mimeType, parameters: ticket.fields ?? {} });
		case "PUT":
			// Raw PUT to a signed URL (Firebase), with the ticket's signed headers.
			return file.upload(ticket.uploadUrl, { httpMethod: "PUT", uploadType: UploadType.BINARY_CONTENT, mimeType, headers: ticket.headers ?? {} });
	}
}

async function sendToStorage(file: File, ticket: CreateFileUploadUrlResponse, mimeType: DocumentMimeType): Promise<void> {
	let result: UploadResult;
	try {
		result = await uploadWith(file, ticket, mimeType);
	} catch {
		throw new FileUploadRejectedError(null);
	}
	if (result.status < HTTP_SUCCESS_MIN || result.status > HTTP_SUCCESS_MAX) {
		throw new FileUploadRejectedError(result.status);
	}
}

/**
 * Uploads a file from the phone and resolves once the API has accepted it
 * (READY). Rejects with the API's own error for a refused ticket or check,
 * {@link FileUploadRejectedError} when storage refuses the bytes, and
 * `FileProcessingError` (@workspace/api-client) when the scan rejects the
 * file or takes too long.
 */
export async function uploadLocalFile(api: FileUploadApi, purpose: FileUploadPurpose, local: LocalFile, signal?: AbortSignal): Promise<FileRecord> {
	const file = new File(local.uri);
	const bytes = await file.bytes();
	const checksumSha256 = toHex(await digest(CryptoDigestAlgorithm.SHA256, bytes));
	const { data: ticket } = await api.files.uploadUrl.mutate({ ...purpose, fileName: local.name, mimeType: local.mimeType, sizeBytes: bytes.byteLength, checksumSha256 });
	await sendToStorage(file, ticket, local.mimeType);
	await api.files.complete.mutate({ fileId: ticket.fileId, checksumSha256 });
	const ready = await waitForFileReady(api, ticket.fileId, { signal });
	return ready.file;
}
