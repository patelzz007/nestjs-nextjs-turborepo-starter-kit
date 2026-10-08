// ============================================
// lib/api/download.ts - typed FILE downloads (analytics exports)
// ============================================
// A file route (`defineFileContract` + `fileResponse(...)` in @workspace/shared)
// answers the file itself, not the JSON envelope, so it is not a query: the
// screens fetch it with `fetchDownload` (or `api.download(...)` from `useAuth()`),
// get a `Blob` + the server's file name, and hand it to `saveDownloadedFile`.
// Same transport rules as every other call: the shared input schema validates
// the input first, cookies + the client-type header authenticate, a 401 runs
// the silent-refresh pipeline once, and an error answer becomes a typed
// `ApiDownloadError` (code, status, Retry-After) — never a corrupt file.

import { apiContract, isStringPrimitive, type ApiFileContractDef, type ApiVersion, type SerializableInput } from "@workspace/shared";
import { z, type ZodType } from "zod";

import {
	ApiError,
	buildUrl,
	mergeProcedureHeaders,
	NO_HTTP_RESPONSE_STATUS,
	readErrorPayload,
	REQUEST_ABORTED_ERROR,
	SessionRefreshUnavailableError,
	withSessionRefresh,
	type ApiErrorPayload,
	type ApiRequestContext,
	type ApiResponse,
} from "./api-request";
import { resolveRequest } from "./endpoints";

/** A file download procedure, derived from its shared contract leaf. */
export interface DownloadDef<Input extends SerializableInput> {
	readonly kind: "download";
	readonly method: "GET";
	readonly path: string;
	readonly version?: ApiVersion | undefined;
	readonly inputSchema: ZodType<Input>;
	/** The media types the endpoint may answer with; anything else is refused as a contract break. */
	readonly contentTypes: readonly string[];
}

/** Declares a download from its shared file contract leaf. */
export function defineDownload<Input extends SerializableInput>(contract: ApiFileContractDef<Input>): DownloadDef<Input> {
	return {
		kind: "download",
		method: contract.method,
		path: contract.path,
		version: contract.version,
		inputSchema: contract.input,
		contentTypes: contract.response.contentTypes,
	};
}

/** Every file download of the API (the counterpart of `apiRouter` for files). */
export const apiDownloads = {
	organizations: {
		/** `GET /orgs/:orgSlug/analytics/export` — the merchant report (`format`: csv | xlsx | pdf; `from` / `to` required). */
		analyticsExport: defineDownload(apiContract.organizations.analyticsExport),
	},
	rewardsAdmin: {
		/** `GET /admin/analytics/export` — the platform report (`format`: csv | xlsx | pdf; `from` / `to` required). */
		analyticsExport: defineDownload(apiContract.rewardsAdmin.analyticsExport),
	},
};

/** A downloaded file: its bytes, the name the server gave it, and its media type. */
export interface DownloadedFile {
	readonly blob: Blob;
	readonly fileName: string;
	readonly contentType: string;
}

/** Machine codes of a failed download the API did not answer with its own code. */
export const DownloadErrorCodeSchema = z.enum(["NETWORK_ERROR", "ABORTED", "UNEXPECTED_CONTENT_TYPE", "SESSION_REFRESH_UNAVAILABLE", "UNAUTHORIZED", "DOWNLOAD_FAILED"]);

export type DownloadErrorCode = z.output<typeof DownloadErrorCodeSchema>;

/**
 * A download that produced no file. `code` is the API's error code
 * (`ANALYTICS_EXPORT_RATE_LIMITED`, `VALIDATION_ERROR`, `FORBIDDEN`, …) or a
 * {@link DownloadErrorCode}; `retryAfterSeconds` is set for a 429.
 */
export class ApiDownloadError extends Error {
	public readonly code: string;
	public readonly statusCode: number;
	public readonly correlationId: string | undefined;
	public readonly retryAfterSeconds: number | undefined;

	public constructor(options: {
		readonly code: string;
		readonly statusCode: number;
		readonly message: string;
		readonly correlationId?: string | undefined;
		readonly retryAfterSeconds?: number | undefined;
	}) {
		super(options.message);
		this.name = "ApiDownloadError";
		this.code = options.code;
		this.statusCode = options.statusCode;
		this.correlationId = options.correlationId;
		this.retryAfterSeconds = options.retryAfterSeconds;
	}
}

/** Per-call options of a download. */
export interface DownloadOptions {
	readonly signal?: AbortSignal | undefined;
}

const RetryAfterSecondsSchema = z.coerce.number().int().positive();
const RetryAfterDetailsSchema = z.object({ retryAfterSeconds: z.number().int().positive() });

/** `filename*=UTF-8''…` (RFC 5987, preferred) or `filename="…"` of a `Content-Disposition` header; `null` when absent. */
export function fileNameFromContentDisposition(header: string | null): string | null {
	if (header === null) {
		return null;
	}
	const extended = /filename\*\s*=\s*UTF-8''(?<name>[^;]+)/i.exec(header)?.groups?.name;
	if (extended !== undefined) {
		try {
			return decodeURIComponent(extended.trim());
		} catch {
			// Malformed percent-encoding — fall back to the plain parameter.
		}
	}
	const quoted = /filename\s*=\s*"(?<name>[^"]*)"/i.exec(header)?.groups?.name;
	if (quoted !== undefined && quoted.length > 0) {
		return quoted;
	}
	const bare = /filename\s*=\s*(?<name>[^;\s]+)/i.exec(header)?.groups?.name;
	return bare ?? null;
}

/** The media type of a `Content-Type` header without its parameters (`text/csv; charset=utf-8` → `text/csv`). */
function mediaTypeOf(contentType: string): string {
	const [mediaType] = contentType.split(";");
	return (mediaType ?? "").trim().toLowerCase();
}

function toDownloadError(error: ApiErrorPayload, status: number, retryAfterHeader: string | null): ApiDownloadError {
	const retryAfter = RetryAfterSecondsSchema.safeParse(retryAfterHeader);
	if (error instanceof ApiDownloadError) {
		return error;
	}
	if (error instanceof SessionRefreshUnavailableError) {
		return new ApiDownloadError({ code: "SESSION_REFRESH_UNAVAILABLE", statusCode: status, message: error.message });
	}
	const headerRetryAfter = retryAfter.success ? retryAfter.data : undefined;
	if (error instanceof ApiError) {
		const details = RetryAfterDetailsSchema.safeParse(error.details);
		return new ApiDownloadError({
			code: error.code ?? "DOWNLOAD_FAILED",
			statusCode: error.statusCode ?? status,
			message: error.message,
			correlationId: error.correlationId,
			retryAfterSeconds: details.success ? details.data.retryAfterSeconds : headerRetryAfter,
		});
	}
	if (status === NO_HTTP_RESPONSE_STATUS) {
		const message = isStringPrimitive(error) ? error : error.message;
		return new ApiDownloadError({ code: message === REQUEST_ABORTED_ERROR ? "ABORTED" : "NETWORK_ERROR", statusCode: status, message });
	}
	return new ApiDownloadError({
		code: status === 401 ? "UNAUTHORIZED" : "DOWNLOAD_FAILED",
		statusCode: status,
		message: isStringPrimitive(error) ? error : error.message,
		retryAfterSeconds: headerRetryAfter,
	});
}

/**
 * Downloads one file. Validates `input` with the contract's schema, sends the
 * session cookies, refreshes the session once on a 401, checks the answer is
 * one of the contract's media types, and resolves the file (name from
 * `Content-Disposition`, else `fallbackFileName`). Rejects with
 * {@link ApiDownloadError} for every failure.
 */
export async function fetchDownload<Input extends SerializableInput>(
	context: ApiRequestContext,
	def: DownloadDef<Input>,
	input: Input,
	options: DownloadOptions & { readonly fallbackFileName?: string | undefined } = {},
): Promise<DownloadedFile> {
	const parsed: Input = def.inputSchema.parse(input);
	const url = buildUrl(context.baseUrl, resolveRequest(def.path, parsed).url, def.version);
	const acceptedTypes = new Set(def.contentTypes.map(mediaTypeOf));
	let retryAfterHeader: string | null = null;

	const execute = async (): Promise<ApiResponse<DownloadedFile>> => {
		try {
			const response = await fetch(url, {
				method: def.method,
				credentials: "include",
				headers: { Accept: def.contentTypes.join(", "), ...mergeProcedureHeaders(context.clientType, undefined) },
				...(options.signal === undefined ? {} : { signal: options.signal }),
			});
			if (!response.ok) {
				retryAfterHeader = response.headers.get("retry-after");
				return { kind: "httpError", ok: false, status: response.status, data: null, error: await readErrorPayload(response) };
			}
			const contentType = response.headers.get("content-type") ?? "";
			if (!acceptedTypes.has(mediaTypeOf(contentType))) {
				return {
					kind: "contract",
					ok: false,
					status: response.status,
					data: null,
					error: new ApiDownloadError({
						code: "UNEXPECTED_CONTENT_TYPE",
						statusCode: response.status,
						message: `Expected one of ${def.contentTypes.join(", ")}, received "${contentType}"`,
					}),
				};
			}
			const fileName = fileNameFromContentDisposition(response.headers.get("content-disposition")) ?? options.fallbackFileName ?? "download";
			return { kind: "success", ok: true, status: response.status, data: { blob: await response.blob(), fileName, contentType } };
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return { kind: "aborted", ok: false, status: NO_HTTP_RESPONSE_STATUS, data: null, error: REQUEST_ABORTED_ERROR };
			}
			return { kind: "network", ok: false, status: NO_HTTP_RESPONSE_STATUS, data: null, error: error instanceof Error ? error : new Error(String(error)) };
		}
	};

	const result = await withSessionRefresh(execute, { onRefresh: context.onRefresh, onUnauthorized: context.onUnauthorized });
	if (!result.ok) {
		throw toDownloadError(result.error, result.status, retryAfterHeader);
	}
	return result.data;
}

/** Creates and releases `blob:` URLs (the browser's `URL`; replaceable in tests). */
export interface ObjectUrlFactory {
	createObjectURL(blob: Blob): string;
	revokeObjectURL(url: string): void;
}

/** How long the object URL of a saved file stays alive. */
const OBJECT_URL_RELEASE_DELAY_MS = 1_000;

/**
 * Hands a downloaded file to the browser's "save" flow (an object URL on a
 * temporary `<a download>`), then releases the URL. Browser only.
 */
export function saveDownloadedFile(file: DownloadedFile, doc: Document = document, objectUrls: ObjectUrlFactory = URL): void {
	const url = objectUrls.createObjectURL(file.blob);
	const anchor = doc.createElement("a");
	anchor.href = url;
	anchor.download = file.fileName;
	anchor.rel = "noopener";
	doc.body.append(anchor);
	anchor.click();
	anchor.remove();
	// Released after the browser has started the save (some browsers cancel it when the URL is revoked synchronously).
	setTimeout(() => {
		objectUrls.revokeObjectURL(url);
	}, OBJECT_URL_RELEASE_DELAY_MS);
}
