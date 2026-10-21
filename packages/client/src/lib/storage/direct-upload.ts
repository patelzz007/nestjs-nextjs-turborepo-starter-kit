// ============================================
// lib/storage/direct-upload.ts - browser → object storage uploads
// ============================================
// The API issues an upload ticket (`POST /files/upload-url`); the browser
// sends the bytes straight to object storage with the ticket's METHOD; the
// API then verifies the object (`POST /files/:id/complete`) and scans it.
//
// Shape:
// - one `StorageUploadStrategy` per ticket method, in a registry — a new
//   storage provider's method is one more entry, nothing else changes;
// - every failure is a typed `DirectUploadError` (never assumed success: a
//   response the browser could not read — CORS, network — is a FAILED upload);
// - `waitForFileReady` is the one bounded poll for the scan verdict, so apps
//   never reimplement it.

import {
	DocumentMimeTypeSchema,
	type BrowserUploadMethod,
	type CompleteFileUploadResponse,
	type CreateFileUploadUrlInput,
	type CreateFileUploadUrlResponse,
	type CreateTenantFileUploadUrlInput,
	type DocumentMimeType,
} from "@workspace/shared";

import type { ApiClient } from "../api/use-api";
import type { ApiRouter } from "../api/endpoints";

export async function calculateFileSha256Hex(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	const digest = await crypto.subtle.digest("SHA-256", buffer);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export interface DirectUploadResult {
	readonly fileId: string;
	readonly response: CompleteFileUploadResponse;
}

/** A platform upload (`POST /files/upload-url`): a product image, the caller's avatar or a GitHub comment image. */
export type DirectUploadInput = Omit<CreateFileUploadUrlInput, "checksumSha256" | "sizeBytes">;

/** A tenant-owned upload (`POST /tenants/:tenantSlug/files/upload-url`): the route names the tenant, never the body. */
export type TenantDirectUploadInput = Omit<CreateTenantFileUploadUrlInput, "checksumSha256" | "sizeBytes">;

/** The bytes' facts every upload ticket request carries. */
interface UploadedBytes {
	readonly checksumSha256: string;
	readonly sizeBytes: number;
	readonly mimeType: DocumentMimeType;
}

/**
 * Why a direct upload failed:
 * - `unreachable` — the browser got no readable answer (network failure, or a
 *   storage bucket without CORS rules for this origin). The bytes may or may
 *   not have arrived; the upload is NOT treated as done.
 * - `rejected` — storage answered with a non-2xx status.
 */
export type DirectUploadFailureKind = "unreachable" | "rejected";

export class DirectUploadError extends Error {
	public readonly kind: DirectUploadFailureKind;
	public readonly status: number | null;

	public constructor(kind: DirectUploadFailureKind, message: string, status: number | null = null) {
		super(message);
		this.name = "DirectUploadError";
		this.kind = kind;
		this.status = status;
	}
}

/** Sends a file to object storage for one ticket method. */
export interface StorageUploadStrategy {
	upload(ticket: CreateFileUploadUrlResponse, file: File): Promise<void>;
}

/** Sends one request to storage; a request the browser cannot complete or read is `unreachable`, a non-2xx is `rejected`. */
async function sendToStorage(url: string, init: RequestInit): Promise<void> {
	let response: Response;
	try {
		response = await fetch(url, init);
	} catch (error) {
		const cause: string = error instanceof Error ? error.message : "network error";
		throw new DirectUploadError("unreachable", `Object storage could not be reached (${cause}). The upload did not complete — check the storage CORS rules for this origin.`);
	}
	if (response.ok) {
		return;
	}
	const body: string = await response.text();
	throw new DirectUploadError(
		"rejected",
		body.length > 0 ? `Object storage rejected the upload: ${body}` : `Object storage rejected the upload (HTTP ${String(response.status)})`,
		response.status,
	);
}

/**
 * Multipart form POST (S3 presigned POST, the API's local storage): the
 * ticket's fields go first, IN THE ORDER the API issued them (e.g. `key`,
 * `token`), and the file last — storage reads the policy before the bytes.
 */
export class FormPostUploadStrategy implements StorageUploadStrategy {
	public async upload(ticket: CreateFileUploadUrlResponse, file: File): Promise<void> {
		const formData = new FormData();
		for (const [name, value] of Object.entries(ticket.fields ?? {})) {
			formData.append(name, value);
		}
		formData.append("file", file, file.name);
		await sendToStorage(ticket.uploadUrl, { method: "POST", body: formData });
	}
}

/** Raw PUT to a signed URL (Firebase and other providers), with the ticket's signed headers. */
export class SignedPutUploadStrategy implements StorageUploadStrategy {
	public async upload(ticket: CreateFileUploadUrlResponse, file: File): Promise<void> {
		await sendToStorage(ticket.uploadUrl, { method: "PUT", body: file, headers: ticket.headers ?? {} });
	}
}

/** The strategy for every ticket method the API can issue — a `Record` over the method enum, so a new method fails to compile until it has one. */
export const STORAGE_UPLOAD_STRATEGIES: Readonly<Record<BrowserUploadMethod, StorageUploadStrategy>> = {
	POST_MULTIPART: new FormPostUploadStrategy(),
	PUT: new SignedPutUploadStrategy(),
};

export async function uploadFileWithTicket(ticket: CreateFileUploadUrlResponse, file: File): Promise<void> {
	await STORAGE_UPLOAD_STRATEGIES[ticket.method].upload(ticket, file);
}

/** Ticket (from `requestTicket`) → bytes to storage → `files/complete`, shared by both upload routes. */
async function uploadThroughTicket(
	api: ApiClient<ApiRouter>,
	file: File,
	requestTicket: (bytes: UploadedBytes) => Promise<CreateFileUploadUrlResponse>,
): Promise<DirectUploadResult> {
	const checksumSha256 = await calculateFileSha256Hex(file);
	const ticket: CreateFileUploadUrlResponse = await requestTicket({ checksumSha256, sizeBytes: file.size, mimeType: toDocumentMimeType(file) });

	await uploadFileWithTicket(ticket, file);

	const completedEnvelope = await api.files.complete.mutate({
		fileId: ticket.fileId,
		checksumSha256,
	});
	return { fileId: ticket.fileId, response: completedEnvelope.data };
}

/** Uploads a platform file (`POST /files/upload-url`) and completes it. */
export function uploadFileDirect(api: ApiClient<ApiRouter>, input: DirectUploadInput, file: File): Promise<DirectUploadResult> {
	return uploadThroughTicket(api, file, async (bytes: UploadedBytes): Promise<CreateFileUploadUrlResponse> => (await api.files.uploadUrl.mutate({ ...input, ...bytes })).data);
}

/** Uploads a file of `tenantSlug` (`POST /tenants/:tenantSlug/files/upload-url`) and completes it. */
export function uploadTenantFileDirect(api: ApiClient<ApiRouter>, tenantSlug: string, input: TenantDirectUploadInput, file: File): Promise<DirectUploadResult> {
	return uploadThroughTicket(
		api,
		file,
		async (bytes: UploadedBytes): Promise<CreateFileUploadUrlResponse> => (await api.files.tenantUploadUrl.mutate({ tenantSlug, ...input, ...bytes })).data,
	);
}

// ── Waiting for the scan verdict ────────────────────────────────────────────
// The poll is platform-neutral and shared with the mobile app (@workspace/api-client).

export {
	FILE_READY_INITIAL_DELAY_MS,
	FILE_READY_MAX_DELAY_MS,
	FILE_READY_TIMEOUT_MS,
	FileProcessingError,
	FileWaitAbortedError,
	pollWithBackoff,
	waitForFileReady,
	type FileProcessingFailureKind,
	type FileStatusReader,
	type PollingOptions,
	type PollVerdict,
	type WaitForFileReadyOptions,
} from "@workspace/api-client";

export function toDocumentMimeType(file: File): DocumentMimeType {
	const parsed = DocumentMimeTypeSchema.safeParse(file.type);
	if (!parsed.success) {
		throw new Error("Unsupported file type");
	}
	return parsed.data;
}
