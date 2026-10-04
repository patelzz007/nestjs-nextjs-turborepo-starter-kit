// ============================================
// lib/api-request.ts - tRPC-flavoured REST client (procedure-first, no React)
// ============================================
// Transport is plain REST, but the public surface mirrors tRPC: every call goes
// through a typed procedure def (`QueryDef` / `MutationDef`) with a single
// zod-validated input. `resolveRequest` serializes input → URL (+ body for
// mutations). `createCaller` walks any router tree and binds `.fetch()` /
// `.fetchOrThrow()` on queries and `.mutate()` on mutations — same model as the
// server-side caller in `server-api.ts`.

import {
	ApiErrorBodySchema as ApiErrorSchema,
	ApiErrorResponseSchema,
	apiVersionPrefix,
	clientTypeHeader,
	JsonValueSchema,
	MUTATION_INTENT_HEADER,
	MUTATION_INTENT_VALUE,
	type ApiErrorBody,
	type ApiErrorDetails,
	type ApiErrorResponse,
	type ApiVersion,
	type AuthClientType,
	type DataValue,
	type JsonValue,
	type SerializableInput,
} from "@workspace/shared";
import { z, type ZodType } from "zod";

import { createTransientFailureBreaker } from "../auth/transient-failure-breaker";
import { API_URL_PREFIX } from "./config";
import { ApiResponseContractError, parseResponseText, type ResponseContractSource } from "./response-contract";
import { resolveRequest, eachRouterEntry, isRouterSubtree, type MutationDef, type ProcedureDef, type QueryDef, type RouterTree, type RouterTreeValue } from "./endpoints";

// ── Auth callbacks & client config ───────────────────────────────────────────

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export type HttpMethod = z.output<typeof HttpMethodSchema>;

/** Callback invoked when an API request fails with 401 Unauthorized. */
export type OnUnauthorized = () => void | Promise<void>;

/**
 * Called on 401 to silently refresh the session. Resolves how the refresh
 * ended: `ok` retries the request, `expired` ends the session
 * (`onUnauthorized`), `transient` fails only this request with a
 * {@link SessionRefreshUnavailableError} — an unreachable API is not a dead session.
 */
export type OnRefresh = () => Promise<RefreshResult>;

/**
 * Runtime context shared by every procedure call on the client. `clientType`
 * is required: it names the frontend's isolated cookie set, and the client
 * never lets the API guess it.
 */
export interface ApiRequestContext {
	readonly baseUrl: string;
	readonly clientType: AuthClientType;
	readonly onUnauthorized?: OnUnauthorized | undefined;
	readonly onRefresh?: OnRefresh | undefined;
}

/** Context for lifecycle calls that must bypass the 401 refresh pipeline (refresh / logout). */
export interface UncheckedApiRequestContext {
	readonly baseUrl: string;
	readonly clientType: AuthClientType;
}

export function createApiRequestContext(baseUrl: string, clientType: AuthClientType, onUnauthorized?: OnUnauthorized, onRefresh?: OnRefresh): ApiRequestContext {
	return { baseUrl, clientType, onUnauthorized, onRefresh };
}

export function createUncheckedApiRequestContext(baseUrl: string, clientType: AuthClientType): UncheckedApiRequestContext {
	return { baseUrl, clientType };
}

export function mutationIntentHeaders(): Record<string, string> {
	return { [MUTATION_INTENT_HEADER]: MUTATION_INTENT_VALUE };
}

/**
 * The headers of one procedure call. The procedure's own headers come first;
 * the mutation-intent and client-type headers come last, so nothing a call
 * site passes can drop or rewrite them.
 */
export function mergeProcedureHeaders(clientType: AuthClientType, headers: Record<string, string> | undefined): Record<string, string> {
	return { ...headers, ...mutationIntentHeaders(), ...clientTypeHeader(clientType) };
}

export const RefreshResultSchema = z.enum(["ok", "expired", "transient"]);

export type RefreshResult = z.output<typeof RefreshResultSchema>;

export type RefreshCall = () => Promise<RefreshResult>;

/** After a transient refresh failure, further refreshes are skipped for this long (mirrors the proxy's fall-through). */
export const REFRESH_TRANSIENT_COOLDOWN_MS = 30_000;

/** The one key of a tab's refresh breaker: a tab has one session. */
const TAB_SESSION_KEY = "session";

/** Every tracked key of a single-session breaker. */
const SINGLE_SESSION_KEYS = 1;

/**
 * Wraps a refresh so a dead API is not re-hit on every 401: inside the
 * cooldown that follows a transient failure, the call resolves `"transient"`
 * without touching the API. An expired session or a success settles it.
 * Keeps how the refresh ended, so callers can tell a dead session from an
 * unreachable API. Same breaker as the route proxy
 * (`../auth/transient-failure-breaker.ts`), with one key: a tab has one session.
 */
export function createRefreshCooldown(refresh: RefreshCall, cooldownMs = REFRESH_TRANSIENT_COOLDOWN_MS): RefreshCall {
	const breaker = createTransientFailureBreaker({ cooldownMs, circuitThreshold: 1, circuitWindowMs: cooldownMs, maxTrackedKeys: SINGLE_SESSION_KEYS });

	return async (): Promise<RefreshResult> => {
		if (breaker.isCoolingDown(TAB_SESSION_KEY)) {
			return "transient";
		}

		const result = await refresh();
		if (result === "transient") {
			breaker.recordTransientFailure(TAB_SESSION_KEY);
		} else {
			breaker.recordSettled(TAB_SESSION_KEY);
		}
		return result;
	};
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

export { ApiErrorSchema, type ApiErrorBody };

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

export type ApiErrorPayload = Error | string;

// ── Transport envelope ───────────────────────────────────────────────────────

type QueryParams = Record<string, string | number | boolean | undefined>;

export interface BaseRequestOptions {
	query?: QueryParams | undefined;
	headers?: Record<string, string> | undefined;
	signal?: AbortSignal | undefined;
}

export type RequestOptions<Method extends HttpMethod, Body = undefined> = Method extends "GET" ? BaseRequestOptions : BaseRequestOptions & { body: Body };

export interface ApiSuccess<T> {
	ok: true;
	status: number;
	data: T;
}

export interface ApiFailure {
	ok: false;
	status: number;
	data: null;
	error: ApiErrorPayload;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Per-call overrides on top of the procedure def (signal, extra headers). */
export interface ProcedureCallOptions {
	readonly signal?: AbortSignal | undefined;
	readonly headers?: Record<string, string> | undefined;
}

// ── tRPC-style caller leaves ─────────────────────────────────────────────────

/** One GET leaf — `.fetch()` returns the transport envelope, `.fetchOrThrow()` throws on failure. */
export interface QueryCaller<Input, Resp> {
	fetch(input: Input, options?: ProcedureCallOptions): Promise<ApiResponse<Resp>>;
	fetchOrThrow(input: Input, options?: ProcedureCallOptions): Promise<Resp>;
}

/** One mutation leaf — `.mutate()` throws on failure; `.fetch()` returns the envelope. */
export interface MutationCaller<Input, Resp> {
	mutate(input: Input): Promise<Resp>;
	fetch(input: Input): Promise<ApiResponse<Resp>>;
	fetchOrThrow(input: Input): Promise<Resp>;
}

/** Recursively maps a router tree to tRPC-style caller leaves. */
export type CallerTreeBranch<V> =
	V extends QueryDef<infer Input, infer Resp>
		? QueryCaller<Input, Resp>
		: V extends MutationDef<infer Input, infer Resp>
			? MutationCaller<Input, Resp>
			: V extends object
				? CallerTree<V>
				: V;

/** Recursively maps a router tree to tRPC-style caller leaves. */
export type CallerTree<R extends object> = { [K in keyof R]: CallerTreeBranch<R[K]> };

/** Erased build-time shape — widened so each router key can accept any branch variant. */
type CallerTreeBuild<R extends RouterTree> = {
	[K in keyof R]?: CallerTreeBranch<RouterTreeValue>;
};

function isCompleteCallerTree<R extends RouterTree>(router: R, candidate: CallerTreeBuild<R>): candidate is CallerTree<R> {
	let complete = true;
	eachRouterEntry(router, (key) => {
		if (candidate[key] === undefined) {
			complete = false;
		}
	});
	return complete;
}

function mapCallerBranch(value: RouterTreeValue, context: ApiRequestContext): CallerTreeBranch<RouterTreeValue> {
	if (isRouterSubtree(value)) {
		return createCaller(value, context);
	}
	if (value.kind === "query") {
		return createQueryCaller(context, value);
	}
	return createMutationCaller(context, value);
}

function buildCallerTree<R extends RouterTree>(router: R, context: ApiRequestContext): CallerTree<R> {
	const out: CallerTreeBuild<R> = {};

	eachRouterEntry(router, (key, value) => {
		out[key] = mapCallerBranch(value, context);
	});

	if (!isCompleteCallerTree(router, out)) {
		throw new Error("Failed to build caller tree — one or more router entries were not bound.");
	}

	return out;
}

function extractErrorMessage(error: Error | string, status: number): string {
	if (typeof error === "string" && error.length > 0) {
		return error;
	}
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}
	return `Request failed (${String(status)})`;
}

const SESSION_DEAD_ERROR_CODES: readonly string[] = ["TOKEN_VERSION_MISMATCH", "REFRESH_TOKEN_REVOKED", "TOKEN_THEFT_DETECTED"];

/**
 * The `status` of an {@link ApiFailure} that never got an HTTP answer
 * (network error, CORS, aborted request).
 */
export const NO_HTTP_RESPONSE_STATUS = 0;

/** The `error` of an {@link ApiFailure} whose request was aborted (its `AbortSignal` fired). */
export const REQUEST_ABORTED_ERROR = "aborted";

/**
 * A 401 whose code says the whole session was revoked (password change,
 * revocation, token theft) — refreshing cannot bring it back, so neither the
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
 * then raw text. `statusCode` always falls back to the real HTTP status.
 */
export async function readErrorPayload(response: Response): Promise<ApiErrorPayload> {
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

function buildUrl(baseUrl: string, path: string, query?: QueryParams, version?: ApiVersion): string {
	const prefix: string = version === undefined ? API_URL_PREFIX : apiVersionPrefix(version);
	const url = new URL(`${prefix}${path}`, baseUrl);
	if (query) {
		Object.entries(query).forEach(([key, value]) => {
			if (value !== undefined) url.searchParams.set(key, String(value));
		});
	}
	return url.toString();
}

function buildHeaders(baseHeaders: Record<string, string> | undefined): Record<string, string> {
	return {
		Accept: "application/json",
		...baseHeaders,
	};
}

/** Low-level HTTP executor — internal; procedure callers are the public entry point. */
async function executeHttp<T, Body = undefined>(
	baseUrl: string,
	method: HttpMethod,
	path: string,
	options: (BaseRequestOptions & { body?: Body }) | undefined,
	responseSchema: ZodType<T>,
	bodySchema: ZodType<Body> | undefined,
	onUnauthorized?: OnUnauthorized,
	onRefresh?: OnRefresh,
	version?: ApiVersion,
): Promise<ApiResponse<T>> {
	const url = buildUrl(baseUrl, path, options?.query, version);
	const headers = buildHeaders(options?.headers);
	const signal: AbortSignal | undefined = options?.signal;
	const init: RequestInit = {
		method,
		headers,
		...(signal === undefined ? {} : { signal }),
		credentials: "include",
	};

	if (method !== "GET" && options && "body" in options) {
		if (options.body instanceof FormData) {
			init.body = options.body;
		} else {
			if (bodySchema) bodySchema.parse(options.body);
			headers["Content-Type"] = "application/json";
			init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
		}
	}

	const execute = async (targetUrl: string): Promise<ApiResponse<T>> => {
		try {
			const res = await fetch(targetUrl, init);
			const isJson = res.headers.get("content-type")?.includes("application/json") ?? false;

			if (!res.ok) {
				const errorData: ApiErrorPayload = await readErrorPayload(res);
				return { ok: false, status: res.status, data: null, error: errorData };
			}

			const source: ResponseContractSource = { method, url: targetUrl, status: res.status };
			const text: string = isJson ? await res.text() : "";
			// The one response-validation point of the browser transport (ADR 022).
			const data: T = parseResponseText(responseSchema, text, source);

			return { ok: true, status: res.status, data };
		} catch (error) {
			if (error instanceof ApiResponseContractError) {
				return { ok: false, status: error.status, data: null, error };
			}
			if (error instanceof DOMException && error.name === "AbortError") {
				return { ok: false, status: NO_HTTP_RESPONSE_STATUS, data: null, error: REQUEST_ABORTED_ERROR };
			}
			if (error instanceof Error || typeof error === "string") {
				return { ok: false, status: NO_HTTP_RESPONSE_STATUS, data: null, error };
			}
			return { ok: false, status: NO_HTTP_RESPONSE_STATUS, data: null, error: new Error(String(error)) };
		}
	};

	let result: ApiResponse<T> = await execute(url);

	if (!result.ok && result.status === 401 && onRefresh && !isDeadSessionError(result.error)) {
		const refreshed: RefreshResult = await onRefresh();
		if (refreshed === "ok") {
			result = await execute(url);
		} else if (refreshed === "transient") {
			// No verdict on the session: fail this request only, never the session.
			return { ok: false, status: result.status, data: null, error: new SessionRefreshUnavailableError() };
		}
		// `expired`: the session is dead — fall through to `onUnauthorized`.
	}

	if (!result.ok && result.status === 401 && onUnauthorized) {
		await onUnauthorized();
		return { ok: false, status: result.status, data: null, error: "Unauthorized" };
	}

	return result;
}

function throwOnFailure<T>(res: ApiResponse<T>): T {
	if (!res.ok) {
		if (res.error instanceof Error) {
			throw res.error;
		}
		throw new Error(extractErrorMessage(res.error, res.status));
	}
	return res.data;
}

function procedureHeaders<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext | UncheckedApiRequestContext,
	def: QueryDef<Input, Resp> | MutationDef<Input, Resp>,
	options?: ProcedureCallOptions,
): Record<string, string> {
	return mergeProcedureHeaders(context.clientType, {
		...def.baseOptions?.headers,
		...options?.headers,
	});
}

// ── Procedure execution (tRPC-style) ───────────────────────────────────────

export function fetchQuery<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: QueryDef<Input, Resp>,
	input: Input,
	options?: ProcedureCallOptions,
): Promise<ApiResponse<Resp>> {
	const parsed: Input = def.inputSchema.parse(input);
	const url: string = resolveRequest(def.path, parsed).url;
	return executeHttp<Resp>(
		context.baseUrl,
		"GET",
		url,
		{ headers: procedureHeaders(context, def, options), signal: options?.signal },
		def.responseSchema,
		undefined,
		context.onUnauthorized,
		context.onRefresh,
		def.version,
	);
}

export async function fetchQueryOrThrow<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: QueryDef<Input, Resp>,
	input: Input,
	options?: ProcedureCallOptions,
): Promise<Resp> {
	return throwOnFailure(await fetchQuery(context, def, input, options));
}

export function fetchMutation<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: MutationDef<Input, Resp>,
	input: Input,
): Promise<ApiResponse<Resp>> {
	const parsed: Input = def.inputSchema.parse(input);
	const { url, body } = resolveRequest(def.path, parsed, { method: def.method, toQuery: def.toQuery });
	const finalBody: DataValue = def.toBody !== undefined ? def.toBody(parsed) : (body ?? {});
	return executeHttp<Resp, DataValue>(
		context.baseUrl,
		def.method,
		url,
		{ body: finalBody, headers: procedureHeaders(context, def) },
		def.responseSchema,
		undefined,
		context.onUnauthorized,
		context.onRefresh,
		def.version,
	);
}

export async function fetchMutationOrThrow<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: MutationDef<Input, Resp>,
	input: Input,
): Promise<Resp> {
	return throwOnFailure(await fetchMutation(context, def, input));
}

/** Lifecycle calls (refresh / logout) that must not re-enter the 401 pipeline. */
export function fetchMutationUnchecked<Input extends SerializableInput, Resp extends DataValue>(
	context: UncheckedApiRequestContext,
	def: MutationDef<Input, Resp>,
	input: Input,
): Promise<ApiResponse<Resp>> {
	const parsed: Input = def.inputSchema.parse(input);
	const { url, body } = resolveRequest(def.path, parsed, { method: def.method, toQuery: def.toQuery });
	const finalBody: DataValue = def.toBody !== undefined ? def.toBody(parsed) : (body ?? {});
	return executeHttp<Resp, DataValue>(
		context.baseUrl,
		def.method,
		url,
		{ body: finalBody, headers: procedureHeaders(context, def) },
		def.responseSchema,
		undefined,
		undefined,
		undefined,
		def.version,
	);
}

export function createQueryCaller<Input extends SerializableInput, Resp extends DataValue>(context: ApiRequestContext, def: QueryDef<Input, Resp>): QueryCaller<Input, Resp> {
	return {
		fetch: (input, options?): Promise<ApiResponse<Resp>> => fetchQuery(context, def, input, options),
		fetchOrThrow: (input, options?): Promise<Resp> => fetchQueryOrThrow(context, def, input, options),
	};
}

export function createMutationCaller<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: MutationDef<Input, Resp>,
): MutationCaller<Input, Resp> {
	return {
		mutate: (input): Promise<Resp> => fetchMutationOrThrow(context, def, input),
		fetch: (input): Promise<ApiResponse<Resp>> => fetchMutation(context, def, input),
		fetchOrThrow: (input): Promise<Resp> => fetchMutationOrThrow(context, def, input),
	};
}

export function createProcedureCaller<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: ProcedureDef<Input, Resp>,
): QueryCaller<Input, Resp> | MutationCaller<Input, Resp> {
	if (def.kind === "query") {
		return createQueryCaller(context, def);
	}
	return createMutationCaller(context, def);
}

/**
 * Walks a router tree and binds every leaf to a tRPC-style caller.
 * `caller.auth.me.fetchOrThrow(undefined)` — no manual path/method wiring.
 */
export function createCaller<R extends RouterTree>(router: R, context: ApiRequestContext): CallerTree<R> {
	return buildCallerTree(router, context);
}
