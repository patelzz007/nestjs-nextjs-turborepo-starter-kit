// ============================================
// file-readiness.ts - Waiting for an uploaded file to become usable
// ============================================
// After `POST /files/:id/complete` the API scans the file (inline, or on a
// queue) and only then promotes it to READY. `waitForFileReady` is the one
// bounded poll for that verdict, shared by the Next apps and the mobile app so
// no app reimplements it; `pollWithBackoff` is its generic core.

import type { CompleteFileUploadResponse, FileStatus } from "@workspace/shared";

import type { QueryCaller } from "./request";

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

/** The `files.detail` read the poll needs (every app's typed API client satisfies it). */
export interface FileStatusReader {
	readonly files: { readonly detail: Pick<QueryCaller<{ readonly fileId: string }, { readonly data: CompleteFileUploadResponse }>, "fetchOrThrow"> };
}

/** Name every runtime gives an aborted operation (`AbortErrorSchema` in `./http`). */
const ABORTED_WAIT_NAME = "AbortError";

/** The wait was aborted without a reason of its own — named like an aborted `fetch`, on every runtime (React Native has no DOM exceptions). */
export class FileWaitAbortedError extends Error {
	public constructor() {
		super("The wait for the file was aborted");
		this.name = ABORTED_WAIT_NAME;
	}
}

function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
	return new Promise((resolve, reject): void => {
		if (signal?.aborted === true) {
			reject(signal.reason instanceof Error ? signal.reason : new FileWaitAbortedError());
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			(): void => {
				clearTimeout(timer);
				reject(signal.reason instanceof Error ? signal.reason : new FileWaitAbortedError());
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
