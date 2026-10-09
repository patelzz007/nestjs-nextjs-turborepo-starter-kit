// ============================================
// request.ts - tRPC-flavoured REST client (procedure-first, no React)
// ============================================
// Transport is plain REST, but the public surface mirrors tRPC: every call goes
// through a typed procedure def (`QueryDef` / `MutationDef`) with a single
// zod-validated input. `resolveRequest` serializes input → URL (+ body for
// mutations). `createCaller` walks any router tree and binds `.fetch()` /
// `.fetchOrThrow()` on queries and `.mutate()` on mutations — same model as the
// web SSR caller in `@workspace/client` (`lib/api/server-request.ts`).
//
// Platform-neutral: `fetch`, `URL`, `FormData` and `AbortSignal` only, so the
// same core runs in the Next apps and in React Native. How the session
// travels is the context's transport (`transport.ts`).

import {
	isStringPrimitive,
	RefreshTokenBodySchema,
	type ApiVersion,
	type AuthClientType,
	type DataValue,
	type RefreshTokenInput,
	type SerializableInput,
	type ToDiscoUnion,
} from "@workspace/shared";
import { z, type ZodType } from "zod";

import { readErrorPayload, SessionRefreshUnavailableError, isDeadSessionError, type ApiErrorPayload } from "./errors";
import { AbortErrorSchema, buildUrl, HTTP_UNAUTHORIZED_STATUS, mergeProcedureHeaders, NO_HTTP_RESPONSE_STATUS, REQUEST_ABORTED_ERROR, type HttpMethod } from "./http";
import type { RefreshResult } from "./refresh";
import { ApiResponseContractError, parseResponseText, type ResponseContractSource } from "./response-contract";
import { assertCompleteRouterTree, mapRouterTree, resolveRequest, type MutationDef, type QueryDef, type RouterTree, type RouterTreeValue } from "./router";
import {
	ANONYMOUS_TOKEN_REQUEST_TRANSPORT,
	COOKIE_ATTEMPT_AUTHORIZATION,
	COOKIE_REQUEST_TRANSPORT,
	tokenAttemptAuthorization,
	type AttemptAuthorization,
	type RequestTransport,
	type TokenRequestTransport,
} from "./transport";

// ── Session callbacks & request context ─────────────────────────────────────

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
 * Runtime context shared by every procedure call. `clientType` is required:
 * it names the frontend's isolated cookie set (or the mobile token
 * transport), and the client never lets the API guess it.
 *
 * `transport` defaults to the cookie transport, whose 401 handling is
 * `onRefresh` + `onUnauthorized` (the web auth facade's). A token transport
 * (`createApiClientContext` with `kind: "token"`) carries its own refresh and
 * session end, and ignores those two callbacks.
 */
export interface ApiRequestContext {
	readonly baseUrl: string;
	readonly clientType: AuthClientType;
	readonly onUnauthorized?: OnUnauthorized | undefined;
	readonly onRefresh?: OnRefresh | undefined;
	readonly transport?: RequestTransport | undefined;
	/** Sent as `X-App-Version` on every request (mobile only, ADR 033). */
	readonly appVersion?: string | undefined;
	/** Static headers sent with every request (`ApiClientConfig.headers`); a per-call header of the same name wins. */
	readonly headers?: Readonly<Record<string, string>> | undefined;
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

// ── Transport envelope ───────────────────────────────────────────────────────

/** The fields every failed call carries — `error` narrowed per kind of failure. */
interface ApiFailureFields<E extends ApiErrorPayload> {
	ok: false;
	status: number;
	data: null;
	error: E;
}

/**
 * How one API call ended, as a discriminated union on `kind` (built with `ToDiscoUnion`).
 * `ok`, `status`, `data` and `error` keep their meaning, so `if (res.ok)` still narrows;
 * `kind` names the case, so a caller can `switch (res.kind)` instead of guessing it from
 * `status` and the type of `error`.
 */
export type ApiResponse<T> = ToDiscoUnion<
	{
		/** A 2xx answer whose body matched the response contract. */
		success: { ok: true; status: number; data: T };
		/** The API answered with a non-2xx status; `error` is its error body (an `ApiError`) or its text. */
		httpError: ApiFailureFields<ApiErrorPayload>;
		/**
		 * The API answered, but not with what its contract promises (ADR 022): an
		 * `ApiResponseContractError` for a JSON body, an `ApiDownloadError` for a file of the wrong type.
		 */
		contract: ApiFailureFields<Error>;
		/** No HTTP answer at all — offline, DNS, CORS. `status` is {@link NO_HTTP_RESPONSE_STATUS}. */
		network: ApiFailureFields<ApiErrorPayload>;
		/** The caller aborted the request. `status` is {@link NO_HTTP_RESPONSE_STATUS}. */
		aborted: ApiFailureFields<typeof REQUEST_ABORTED_ERROR>;
		/** A 401 whose silent refresh got no verdict: only this call failed; the session stands. */
		sessionUnavailable: ApiFailureFields<SessionRefreshUnavailableError>;
		/** A 401 that ended the session — `onUnauthorized` has already run. */
		unauthorized: ApiFailureFields<ApiErrorPayload>;
	},
	"kind"
>;

/** The successful case of {@link ApiResponse}. */
export type ApiSuccess<T> = Extract<ApiResponse<T>, { ok: true }>;

/** Every failed case of {@link ApiResponse} — narrow further on `kind`. */
export type ApiFailure = Extract<ApiResponse<null>, { ok: false }>;

/** The name of each way a call can end — `ApiResponse["kind"]`. */
export type ApiResponseKind = ApiResponse<null>["kind"];

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

function extractErrorMessage(error: Error | string, status: number): string {
	if (isStringPrimitive(error) && error.length > 0) {
		return error;
	}
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}
	return `Request failed (${String(status)})`;
}

/** A thrown value the transport can carry as-is in its `error` slot. */
const TransportErrorSchema = z.union([z.instanceof(Error), z.string()]);

function buildHeaders(baseHeaders: Record<string, string> | undefined): Record<string, string> {
	return {
		Accept: "application/json",
		...baseHeaders,
	};
}

/** One HTTP call of {@link executeHttp}. A mutation carries `body`; a query has no `body` key at all. */
interface HttpRequest<T> {
	readonly baseUrl: string;
	readonly method: HttpMethod;
	readonly path: string;
	readonly headers: Record<string, string>;
	readonly body?: DataValue;
	readonly signal?: AbortSignal | undefined;
	readonly responseSchema: ZodType<T>;
	readonly onUnauthorized?: OnUnauthorized | undefined;
	readonly onRefresh?: OnRefresh | undefined;
	readonly transport?: RequestTransport | undefined;
	readonly version?: ApiVersion | undefined;
}

/** One attempt of a request, authorized the way its transport says. */
type HttpAttempt<T> = (authorization: AttemptAuthorization) => Promise<ApiResponse<T>>;

/** Low-level HTTP executor — internal; procedure callers are the public entry point. */
function executeHttp<T>(request: HttpRequest<T>): Promise<ApiResponse<T>> {
	const { method, responseSchema, signal, onUnauthorized, onRefresh } = request;
	const url = buildUrl(request.baseUrl, request.path, request.version);
	const headers = buildHeaders(request.headers);
	const init: RequestInit = {
		method,
		headers,
		...(signal === undefined ? {} : { signal }),
	};

	if (method !== "GET" && "body" in request) {
		if (request.body instanceof FormData) {
			init.body = request.body;
		} else {
			headers["Content-Type"] = "application/json";
			init.body = isStringPrimitive(request.body) ? request.body : JSON.stringify(request.body);
		}
	}

	const attempt: HttpAttempt<T> = async (authorization: AttemptAuthorization): Promise<ApiResponse<T>> => {
		try {
			const res = await fetch(url, { ...init, headers: { ...headers, ...authorization.headers }, credentials: authorization.credentials });
			const isJson = res.headers.get("content-type")?.includes("application/json") ?? false;

			if (!res.ok) {
				const errorData: ApiErrorPayload = await readErrorPayload(res);
				return { kind: "httpError", ok: false, status: res.status, data: null, error: errorData };
			}

			const source: ResponseContractSource = { method, url, status: res.status };
			const text: string = isJson ? await res.text() : "";
			// The one response-validation point of the client transport (ADR 022).
			const data: T = parseResponseText(responseSchema, text, source);

			return { kind: "success", ok: true, status: res.status, data };
		} catch (error) {
			if (error instanceof ApiResponseContractError) {
				return { kind: "contract", ok: false, status: error.status, data: null, error };
			}
			if (AbortErrorSchema.safeParse(error).success) {
				return { kind: "aborted", ok: false, status: NO_HTTP_RESPONSE_STATUS, data: null, error: REQUEST_ABORTED_ERROR };
			}
			const transportError = TransportErrorSchema.safeParse(error);
			if (transportError.success) {
				return { kind: "network", ok: false, status: NO_HTTP_RESPONSE_STATUS, data: null, error: transportError.data };
			}
			return { kind: "network", ok: false, status: NO_HTTP_RESPONSE_STATUS, data: null, error: new Error(String(error)) };
		}
	};

	const transport: RequestTransport = request.transport ?? COOKIE_REQUEST_TRANSPORT;
	switch (transport.kind) {
		case "cookie":
			return withSessionRefresh(() => attempt(COOKIE_ATTEMPT_AUTHORIZATION), { onRefresh, onUnauthorized });
		case "token":
			return withTokenSession(attempt, transport);
		case "anonymous-token":
			// Lifecycle call of the token transport: no access token, no refresh, no retry.
			return attempt(tokenAttemptAuthorization(null));
	}
}

/**
 * The 401 pipeline every call shares (JSON procedures and file downloads):
 * a 401 triggers ONE silent refresh and a retry; a refresh with no verdict
 * (`transient`) fails only this call with {@link SessionRefreshUnavailableError};
 * a dead session (`expired`, or a dead-session error code) ends in `onUnauthorized`.
 */
export async function withSessionRefresh<T>(
	execute: () => Promise<ApiResponse<T>>,
	callbacks: { readonly onRefresh?: OnRefresh | undefined; readonly onUnauthorized?: OnUnauthorized | undefined },
): Promise<ApiResponse<T>> {
	const { onRefresh, onUnauthorized } = callbacks;
	let result: ApiResponse<T> = await execute();

	if (!result.ok && result.status === HTTP_UNAUTHORIZED_STATUS && onRefresh && !isDeadSessionError(result.error)) {
		const refreshed: RefreshResult = await onRefresh();
		if (refreshed === "ok") {
			result = await execute();
		} else if (refreshed === "transient") {
			// No verdict on the session: fail this request only, never the session.
			return { kind: "sessionUnavailable", ok: false, status: result.status, data: null, error: new SessionRefreshUnavailableError() };
		}
		// `expired`: the session is dead — fall through to `onUnauthorized`.
	}

	if (!result.ok && result.status === HTTP_UNAUTHORIZED_STATUS && onUnauthorized) {
		await onUnauthorized();
		return { kind: "unauthorized", ok: false, status: result.status, data: null, error: "Unauthorized" };
	}

	return result;
}

/**
 * The token transport's session pipeline (ADR 029). Each attempt reads the
 * stored access token and sends it as `Authorization: Bearer`, so the retry
 * after a refresh carries the rotated token. A request sent WITHOUT an access
 * token (signed out: sign-in, sign-up, password reset) has no session to
 * refresh: its 401 is the API's answer (wrong password, …) and is returned
 * as-is. Otherwise a 401 runs the transport's single-flight refresh and
 * retries once ({@link withSessionRefresh}); a refused refresh, a dead-session
 * code or a second 401 ends the session — tokens cleared, `onSessionExpired`
 * called once. A 426 is never refreshed: it surfaces as `UpgradeRequiredError`.
 */
async function withTokenSession<T>(attempt: HttpAttempt<T>, transport: TokenRequestTransport): Promise<ApiResponse<T>> {
	let sentAccessToken: string | null = await transport.tokenProvider.getAccessToken();
	if (sentAccessToken === null) {
		return attempt(tokenAttemptAuthorization(null));
	}

	let isFirstAttempt = true;
	const authorizedAttempt = async (): Promise<ApiResponse<T>> => {
		if (!isFirstAttempt) {
			sentAccessToken = await transport.tokenProvider.getAccessToken();
		}
		isFirstAttempt = false;
		return attempt(tokenAttemptAuthorization(sentAccessToken));
	};

	return withSessionRefresh(authorizedAttempt, {
		onRefresh: transport.refresh,
		onUnauthorized: (): Promise<void> => transport.endSession(sentAccessToken),
	});
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
	context: ApiRequestContext,
	def: QueryDef<Input, Resp> | MutationDef<Input, Resp>,
	options?: ProcedureCallOptions,
): Record<string, string> {
	return mergeProcedureHeaders(
		context.clientType,
		{
			...context.headers,
			...def.baseOptions?.headers,
			...options?.headers,
		},
		context.appVersion,
	);
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
	return executeHttp({
		baseUrl: context.baseUrl,
		method: "GET",
		path: url,
		headers: procedureHeaders(context, def, options),
		signal: options?.signal,
		responseSchema: def.responseSchema,
		onUnauthorized: context.onUnauthorized,
		onRefresh: context.onRefresh,
		transport: context.transport,
		version: def.version,
	});
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
	return executeHttp({
		baseUrl: context.baseUrl,
		method: def.method,
		path: url,
		headers: procedureHeaders(context, def),
		body: finalBody,
		responseSchema: def.responseSchema,
		onUnauthorized: context.onUnauthorized,
		onRefresh: context.onRefresh,
		transport: context.transport,
		version: def.version,
	});
}

export async function fetchMutationOrThrow<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: MutationDef<Input, Resp>,
	input: Input,
): Promise<Resp> {
	return throwOnFailure(await fetchMutation(context, def, input));
}

/**
 * Lifecycle calls (refresh / logout) that must not re-enter the 401 pipeline:
 * a mutation with no `onUnauthorized` / `onRefresh`, whatever object is passed.
 */
export function fetchMutationUnchecked<Input extends SerializableInput, Resp extends DataValue>(
	context: UncheckedApiRequestContext,
	def: MutationDef<Input, Resp>,
	input: Input,
): Promise<ApiResponse<Resp>> {
	return fetchMutation({ baseUrl: context.baseUrl, clientType: context.clientType }, def, input);
}

/** A token-transport lifecycle call was made on a client that does not use the token transport. */
export class TokenTransportRequiredError extends Error {
	public constructor() {
		super("This call presents the stored refresh token and needs a client built with the token transport (client type mobile, ADR 029).");
		this.name = "TokenTransportRequiredError";
	}
}

/**
 * The token transport's lifecycle calls — sign out (`POST /auth/logout`) and sign
 * out everywhere (`POST /auth/logout-all`) — which the API identifies by the
 * stored refresh token in the request body (ADR 029), never by the access token.
 * They bypass the 401 pipeline: a refresh would rotate (spend) the very token
 * being presented. With no valid refresh token stored, the body is empty and the
 * API answers as it does for a signed-out device (logout succeeds idempotently,
 * logout-all is refused). The stored tokens are left alone: whether this device
 * leaves on failure is the app's decision.
 *
 * @throws {TokenTransportRequiredError} when the context does not use the token transport.
 */
export async function fetchBodyTokenLifecycleMutation<Resp extends DataValue>(
	context: ApiRequestContext,
	def: MutationDef<RefreshTokenInput, Resp>,
): Promise<ApiResponse<Resp>> {
	const transport = context.transport;
	if (transport?.kind !== "token") {
		throw new TokenTransportRequiredError();
	}
	const body = RefreshTokenBodySchema.safeParse({ refreshToken: await transport.tokenProvider.getRefreshToken() });
	const input: RefreshTokenInput = body.success ? body.data : {};
	return fetchMutation(
		{ baseUrl: context.baseUrl, clientType: context.clientType, appVersion: context.appVersion, headers: context.headers, transport: ANONYMOUS_TOKEN_REQUEST_TRANSPORT },
		def,
		input,
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

/**
 * Walks a router tree and binds every leaf to a tRPC-style caller.
 * `caller.auth.me.fetchOrThrow(undefined)` — no manual path/method wiring.
 */
export function createCaller<R extends RouterTree>(router: R, context: ApiRequestContext): CallerTree<R> {
	const { nodes, settledKeys } = mapRouterTree<R, CallerTreeBranch<RouterTreeValue>>(router, {
		leaf: (def): CallerTreeBranch<RouterTreeValue> => (def.kind === "query" ? createQueryCaller(context, def) : createMutationCaller(context, def)),
		router: (subtree): CallerTreeBranch<RouterTreeValue> => createCaller(subtree, context),
	});
	assertCompleteRouterTree<R, CallerTree<R>>(router, nodes, settledKeys);
	return nodes;
}
