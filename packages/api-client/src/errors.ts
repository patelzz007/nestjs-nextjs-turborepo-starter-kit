// ============================================
// errors.ts - typed API errors (standard error envelope, ADR 016)
// ============================================
// The API answers every failure with the envelope
// `{ success: false, error: { code, message, details? }, meta: { correlationId, timestamp } }`.
// `readErrorPayload` turns a non-2xx body into an `ApiError` (or the raw text
// for a non-JSON body); a 426 becomes the dedicated `UpgradeRequiredError`
// (ADR 033), which the mobile app turns into its blocking update screen.

import {
	ApiErrorBodySchema as ApiErrorSchema,
	ApiErrorResponseSchema,
	JsonValueSchema,
	type ApiErrorBody,
	type ApiErrorDetails,
	type ApiErrorResponse,
	type JsonValue,
} from "@workspace/shared";

export { ApiErrorSchema, type ApiErrorBody };

/** HTTP status of a request the API refuses because the app build is too old (ADR 033). */
export const HTTP_UPGRADE_REQUIRED_STATUS = 426;

/** Envelope-only fields carried alongside the flattened {@link ApiErrorBody}. */
export interface ApiErrorExtras {
	readonly details?: ApiErrorDetails | undefined;
	readonly correlationId?: string | undefined;
}

/**
 * A failed API call. The API answers every error with the envelope
 * `{ success: false, error: { code, message, details? }, meta: { correlationId, timestamp } }`
 * (docs/technical/api/errors.md); this class flattens it so existing UI code keeps
 * working unchanged:
 *
 * - `error` / `code` — the stable machine code (`"INVALID_CREDENTIALS"`)
 * - `statusCode` — the HTTP status of the response
 * - `details`, `correlationId` — the rest of the envelope (quote the id in support tickets)
 */
export class ApiError extends Error implements ApiErrorBody {
	/** Machine code — kept under its historical name; same value as {@link code}. */
	public readonly error?: string | undefined;
	public readonly code?: string | undefined;
	public readonly statusCode?: number | undefined;
	public readonly details?: ApiErrorDetails | undefined;
	public readonly correlationId?: string | undefined;

	public constructor(body: ApiErrorBody, extras: ApiErrorExtras = {}) {
		super(body.message);
		this.name = "ApiError";
		this.error = body.error;
		this.code = body.error;
		this.statusCode = body.statusCode;
		this.details = extras.details;
		this.correlationId = extras.correlationId;
	}

	/** Build from the API's standard error envelope plus the HTTP status it arrived with. */
	public static fromEnvelope(envelope: ApiErrorResponse, httpStatus: number): ApiError {
		return new ApiError(
			{ message: envelope.error.message, error: envelope.error.code, statusCode: httpStatus },
			{ details: envelope.error.details, correlationId: envelope.meta.correlationId },
		);
	}
}

/**
 * The API refused the request with **426 Upgrade Required**: this build of the
 * mobile app is older than the minimum supported app version (ADR 033). It is
 * never refreshed or retried; the app shows its blocking update screen. It is
 * an {@link ApiError}, so code that only knows `ApiError` still reads its
 * code, status and correlation id.
 */
export class UpgradeRequiredError extends ApiError {
	public constructor(body: ApiErrorBody, extras: ApiErrorExtras = {}) {
		super(body, extras);
		this.name = "UpgradeRequiredError";
	}

	/** Re-types an already flattened 426 {@link ApiError}, keeping every field. */
	public static fromApiError(error: ApiError): UpgradeRequiredError {
		return new UpgradeRequiredError(
			{ message: error.message, error: error.error, statusCode: error.statusCode ?? HTTP_UPGRADE_REQUIRED_STATUS },
			{ details: error.details, correlationId: error.correlationId },
		);
	}
}

/**
 * A request answered 401 and the silent refresh could not run right now (the
 * API was unreachable, answered 5xx, or the refresh is in its cooldown). The
 * session may well be alive, so it is NOT ended: only this request fails, and
 * the next one tries again. The failure keeps the 401 it arrived with.
 */
export class SessionRefreshUnavailableError extends Error {
	public constructor() {
		super("The session could not be refreshed right now. Please try again.");
		this.name = "SessionRefreshUnavailableError";
	}
}

/** What a failed call carries: an `Error` (usually an {@link ApiError}) or the raw response text. */
export type ApiErrorPayload = Error | string;

const SESSION_DEAD_ERROR_CODES: readonly string[] = ["TOKEN_VERSION_MISMATCH", "SESSION_REVOKED", "REFRESH_TOKEN_REVOKED", "TOKEN_THEFT_DETECTED"];

/**
 * A 401 whose code says the whole session was revoked (password change,
 * revocation, this device signed out from another one — ADR 034, token theft) — refreshing cannot bring it back, so neither the
 * 401 pipeline nor the session check tries.
 */
export function isDeadSessionError(error: ApiErrorPayload): boolean {
	if (error instanceof ApiError && error.error !== undefined) {
		return SESSION_DEAD_ERROR_CODES.includes(error.error);
	}
	return false;
}

/**
 * Parse a non-2xx body: the standard error envelope first, then the legacy
 * flat `{ message, error?, statusCode? }` body (older API builds, proxies),
 * then raw text. `statusCode` always falls back to the real HTTP status. A 426
 * always comes back as an {@link UpgradeRequiredError}, whatever its body.
 */
export async function readErrorPayload(response: Response): Promise<ApiErrorPayload> {
	const payload: ApiErrorPayload = await readErrorBody(response);
	return response.status === HTTP_UPGRADE_REQUIRED_STATUS ? toUpgradeRequiredError(payload) : payload;
}

async function readErrorBody(response: Response): Promise<ApiErrorPayload> {
	const text: string = await response.text();
	if (text.length === 0) {
		return new Error(`Request failed (${String(response.status)})`);
	}
	try {
		const json: JsonValue = JsonValueSchema.parse(JSON.parse(text));
		const envelope = ApiErrorResponseSchema.safeParse(json);
		if (envelope.success) {
			return ApiError.fromEnvelope(envelope.data, response.status);
		}
		const flat = ApiErrorSchema.safeParse(json);
		if (flat.success) {
			return new ApiError({ ...flat.data, statusCode: flat.data.statusCode ?? response.status });
		}
	} catch {
		// Not JSON — fall through to raw text.
	}
	return text;
}

function toUpgradeRequiredError(payload: ApiErrorPayload): UpgradeRequiredError {
	if (payload instanceof ApiError) {
		return UpgradeRequiredError.fromApiError(payload);
	}
	const message: string = payload instanceof Error ? payload.message : payload;
	return new UpgradeRequiredError({ message, statusCode: HTTP_UPGRADE_REQUIRED_STATUS });
}
