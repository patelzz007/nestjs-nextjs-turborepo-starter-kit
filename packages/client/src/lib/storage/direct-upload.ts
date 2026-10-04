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
	type DocumentMimeType,
	type FileStatus,
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

export type DirectUploadInput = Omit<CreateFileUploadUrlInput, "checksumSha256" | "sizeBytes">;

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

export async function uploadFileDirect(api: ApiClient<ApiRouter>, input: DirectUploadInput, file: File): Promise<DirectUploadResult> {
	const checksumSha256 = await calculateFileSha256Hex(file);
	const presignBody: CreateFileUploadUrlInput = {
		...input,
		checksumSha256,
		sizeBytes: file.size,
		mimeType: toDocumentMimeType(file),
	};
	const presignedEnvelope = await api.files.uploadUrl.mutate(presignBody);
	const ticket: CreateFileUploadUrlResponse = presignedEnvelope.data;

	await uploadFileWithTicket(ticket, file);

	const completedEnvelope = await api.files.complete.mutate({
		fileId: ticket.fileId,
		checksumSha256,
	});
	return { fileId: ticket.fileId, response: completedEnvelope.data };
}

// ── Waiting for the scan verdict ────────────────────────────────────────────

/** File statuses that end processing badly — the file will never become usable. */
const FAILED_FILE_STATUSES: ReadonlySet<FileStatus> = new Set<FileStatus>(["QUARANTINED", "FAILED", "DELETED"]);

export type FileProcessingFailureKind = "rejected" | "timeout";

/** The file did not become READY: storage processing rejected it (`status`), or the wait ran out. */
export class FileProcessingError extends Error {
	public readonly kind: FileProcessingFailureKind;
	public readonly status: FileStatus | null;

	public constructor(kind: FileProcessingFailureKind, message: string, status: FileStatus | null = null) {
		super(message);
		this.name = "FileProcessingError";
		this.kind = kind;
		this.status = status;
	}
}

export interface PollingOptions {
	readonly signal?: AbortSignal | undefined;
	/** First wait between reads. */
	readonly initialDelayMs?: number | undefined;
	/** Upper bound of one wait (the delay doubles up to it). */
	readonly maxDelayMs?: number | undefined;
	/** Total budget; past it the poll rejects with a `timeout` FileProcessingError. */
	readonly timeoutMs?: number | undefined;
}

/** Options of a wait on one file. */
export type WaitForFileReadyOptions = PollingOptions;

export const FILE_READY_INITIAL_DELAY_MS = 1_000;
export const FILE_READY_MAX_DELAY_MS = 8_000;
export const FILE_READY_TIMEOUT_MS = 120_000;

/** The `files.detail` read the poll needs (`useAuth().api` satisfies it). */
export interface FileStatusReader {
	readonly files: { readonly detail: Pick<ApiClient<ApiRouter>["files"]["detail"], "fetchOrThrow"> };
}

function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
	return new Promise((resolve, reject): void => {
		if (signal?.aborted === true) {
			reject(signal.reason instanceof Error ? signal.reason : new DOMException("aborted", "AbortError"));
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			(): void => {
				clearTimeout(timer);
				reject(signal.reason instanceof Error ? signal.reason : new DOMException("aborted", "AbortError"));
			},
			{ once: true },
		);
	});
}

/** What one read of a polled resource means. */
export type PollVerdict<T> = { readonly kind: "done"; readonly value: T } | { readonly kind: "continue"; readonly progress: T };

/**
 * The one bounded poll of this package: reads, asks `judge` whether the answer
 * is final, and otherwise waits with exponential backoff (initial → max) —
 * until `judge` says done (resolves), `read`/`judge` throw (rejects with that
 * error), the budget runs out (`timeout` FileProcessingError) or `signal`
 * aborts. `onProgress` sees every non-final answer.
 */
export async function pollWithBackoff<T>(
	read: (signal: AbortSignal | undefined) => Promise<T>,
	judge: (value: T) => PollVerdict<T>,
	options: PollingOptions = {},
	onProgress?: (value: T) => void,
): Promise<T> {
	const maxDelayMs: number = options.maxDelayMs ?? FILE_READY_MAX_DELAY_MS;
	const deadline: number = Date.now() + (options.timeoutMs ?? FILE_READY_TIMEOUT_MS);
	let nextDelayMs: number = options.initialDelayMs ?? FILE_READY_INITIAL_DELAY_MS;

	for (;;) {
		const verdict: PollVerdict<T> = judge(await read(options.signal));
		if (verdict.kind === "done") {
			return verdict.value;
		}
		onProgress?.(verdict.progress);
		const remainingMs: number = deadline - Date.now();
		if (remainingMs <= 0) {
			throw new FileProcessingError("timeout", "The file is still being processed. Try again in a moment.");
		}
		await delay(Math.min(nextDelayMs, remainingMs), options.signal);
		nextDelayMs = Math.min(nextDelayMs * 2, maxDelayMs);
	}
}

/**
 * Polls `GET /files/:fileId` until the file is READY (CLEAN, or NOT_SCANNED
 * on a store without a scanner), and rejects as soon as it is QUARANTINED /
 * FAILED (scan failure) / DELETED or scanned INFECTED, when the budget runs
 * out, or when `signal` aborts.
 */
export function waitForFileReady(api: FileStatusReader, fileId: string, options: PollingOptions = {}): Promise<CompleteFileUploadResponse> {
	return pollWithBackoff(
		async (signal: AbortSignal | undefined): Promise<CompleteFileUploadResponse> => (await api.files.detail.fetchOrThrow({ fileId }, { signal })).data,
		(detail: CompleteFileUploadResponse): PollVerdict<CompleteFileUploadResponse> => {
			const status: FileStatus = detail.file.status;
			// A failed scan or a positive verdict is final whatever the lifecycle status says.
			if (FAILED_FILE_STATUSES.has(status) || detail.file.scanStatus === "INFECTED") {
				throw new FileProcessingError("rejected", `The file was not accepted (${status}, scan ${detail.file.scanStatus ?? "pending"}).`, status);
			}
			return status === "READY" ? { kind: "done", value: detail } : { kind: "continue", progress: detail };
		},
		options,
	);
}

export function toDocumentMimeType(file: File): DocumentMimeType {
	const parsed = DocumentMimeTypeSchema.safeParse(file.type);
	if (!parsed.success) {
		throw new Error("Unsupported file type");
	}
	return parsed.data;
}
