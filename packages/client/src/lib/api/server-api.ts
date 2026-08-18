// ============================================
// lib/api/server-api.ts - Server-side API access (tRPC-flavoured, REST)
// ============================================
// The server twin of `useApi`. Where the client builds a router of hooks
// (`api.auth.me.useQuery()`), this module builds a CALLER (`server.auth.me`)
// with `.query()` (direct, parsed), `.prefetch()` (seed a QueryClient) and
// spec factories for `prefetchPage`. The REST transport is the same registry
// (`apiRouter`) + the same `resolveRequest` serializer, so server and client
// compute identical URLs and identical react-query keys — which is what makes
// hydration bind.
//
// `server-only` guard: this module runs in the Node.js runtime (server
// components / route handlers), where `next/headers` cookies + server fetch
// are available. Importing it from a client bundle is a build error.
//
// The pipeline is typed end-to-end with generics — the def's `Input`/`Resp`
// constraints (`SerializableInput` / `JsonValue`) flow through the observable,
// the in-flight dedupe map, and the spec closures, so there is no `unknown`,
// no type assertion, and no eslint-disable anywhere.
import "server-only";

import { dehydrate, QueryClient, type QueryKey } from "@tanstack/react-query";
import { API_BASE_URL, API_URL_PREFIX } from "./config";
import { apiVersionPrefix, type JsonValue, type SerializableInput } from "@workspace/shared";
import { apiRouter, resolveRequest, type ApiRouter, type MutationDef, type ProcedureDef, type QueryDef } from "./endpoints";
import { cookies, headers } from "next/headers";
import { catchError, defer, from, map, mergeMap, Observable, of, retry, throwError, timer, timeout, firstValueFrom } from "rxjs";
import { z } from "zod";

// ── Config ─────────────────────────────────────────────────────────────────

export type ServerApiLogLevel = "silent" | "warn" | "info";

export interface ServerApiConfig {
	/** Cookie that carries the access token (web: `accessToken`, admin: `adminAccessToken`). */
	readonly accessTokenCookie: string;
	/** Cookie that carries the refresh token (web: `refreshToken`, admin: `adminRefreshToken`). */
	readonly refreshTokenCookie: string;
	/** Sent as `X-Client-Type` so the backend writes/clears the matching cookie set. */
	readonly clientType: "web" | "admin";
	/** Mirrors the client's QueryClient defaults so hydrated queries aren't instantly stale. */
	readonly staleTimeMs: number;
	readonly gcTimeMs: number;
	/** Hard per-fetch timeout (aborts the underlying request). */
	readonly timeoutMs: number;
	/** Transient (network) retries, exponential backoff. 0 = fail fast on SSR. */
	readonly retries: number;
	readonly retryDelayMs: number;
	readonly retryBackoffMs: number;
	readonly logger: (event: PrefetchLogEvent) => void;
	readonly logLevel: ServerApiLogLevel;
	/** Test seam — defaults to `globalThis.fetch` (resolved at call time). */
	readonly fetchImpl?: typeof fetch;
}

export const DEFAULT_SERVER_API_CONFIG: ServerApiConfig = {
	accessTokenCookie: "adminAccessToken",
	refreshTokenCookie: "adminRefreshToken",
	clientType: "admin",
	staleTimeMs: 60 * 1000,
	gcTimeMs: 5 * 60 * 1000,
	timeoutMs: 10_000,
	retries: 0,
	retryDelayMs: 500,
	retryBackoffMs: 250,
	logger: createDefaultLogger("warn"),
	logLevel: "warn",
};

/** Web-app variant: same pipeline, the browser auth cookie set (`accessToken`/`refreshToken`). */
export const DEFAULT_WEB_SERVER_API_CONFIG: ServerApiConfig = {
	...DEFAULT_SERVER_API_CONFIG,
	accessTokenCookie: "accessToken",
	refreshTokenCookie: "refreshToken",
	clientType: "web",
};

/** Builds the default structured logger at the requested verbosity. Successes are silent; failures warn. */
export function createDefaultLogger(logLevel: ServerApiLogLevel): (event: PrefetchLogEvent) => void {
	return (event): void => {
		if (logLevel === "silent") return;
		if (event.outcome.ok) return;
		console.warn(`[api-server] prefetch failed (${describeFailure(event.outcome.failure)}) for ${event.path}${event.page === undefined ? "" : ` (${event.page})`}`);
	};
}

/** Merges partial config overrides onto the defaults (re-created logger when the level changes). */
export function resolveConfig(overrides: Partial<ServerApiConfig> | undefined): ServerApiConfig {
	const merged: ServerApiConfig = { ...DEFAULT_SERVER_API_CONFIG, ...overrides };
	if (overrides?.logger === undefined && overrides?.logLevel !== undefined && merged.logLevel !== DEFAULT_SERVER_API_CONFIG.logLevel) {
		return { ...merged, logger: createDefaultLogger(merged.logLevel) };
	}
	return merged;
}

// ── Public types ────────────────────────────────────────────────────────────

/**
 * One prefetch declaration — a CLOSURE the typed caller leaf built from its
 * def + input. Because the def and input are captured (not carried as erased
 * data), the spec needs no generics: `run` just performs the typed prefetch.
 *
 * - `queryKey` (raw input) powers the dev-mode duplicate-key tripwire.
 * - `enabled: false` skips it; a function is evaluated per batch.
 */
export interface PrefetchSpec {
	readonly run: (queryClient: QueryClient, call?: PrefetchCallOptions) => Promise<PrefetchOutcome>;
	/** Key from the RAW input — same contract as the client + prefetch. */
	readonly queryKey: QueryKey;
	readonly enabled?: boolean | (() => boolean);
}

/** Extra per-prefetch knobs beyond the spec (signal, refresh, fallback, headers). */
export interface PrefetchCallOptions<Resp extends JsonValue = JsonValue> {
	readonly signal?: AbortSignal;
	readonly allowRefresh?: boolean;
	readonly fallbackData?: Resp;
	readonly captureHeaders?: readonly string[];
	/** Extra request headers merged over the def's `baseOptions`. */
	readonly headers?: Readonly<Record<string, string>>;
	readonly page?: string;
	readonly traceId?: string;
}

/** Options accepted by the caller's spec factory (`server.x(input, specOptions)`). */
export interface PrefetchSpecOptions<Resp extends JsonValue> {
	readonly enabled?: boolean | (() => boolean);
	readonly config?: Partial<Omit<ServerApiConfig, "logger" | "logLevel" | "fetchImpl">>;
	readonly allowRefresh?: boolean;
	readonly fallbackData?: Resp;
	readonly captureHeaders?: readonly string[];
	readonly headers?: Readonly<Record<string, string>>;
}

/** Structured logger event for one prefetch attempt. */
export interface PrefetchLogEvent {
	readonly queryKey: QueryKey;
	readonly path: string;
	readonly durationMs: number;
	readonly outcome: PrefetchOutcome;
	/** Route tag so logs are attributable to the page that triggered them. */
	readonly page?: string;
	/** Optional correlation id (e.g. the incoming request's id). */
	readonly traceId?: string;
}

/**
 * Classified failure — a discriminated union, never a bare string. Each branch
 * is actionable: missing cookie, network unreachable, HTTP status, schema
 * mismatch, deadline exceeded, or caller abort.
 */
export type PrefetchFailure =
	| { readonly kind: "no-cookie" }
	| { readonly kind: "unreachable"; readonly cause: string }
	| { readonly kind: "http"; readonly status: number }
	| { readonly kind: "schema"; readonly message: string }
	| { readonly kind: "timeout" }
	| { readonly kind: "aborted" };

/** Result of one prefetch attempt — success (with optional captured headers), or a classified failure. */
export type PrefetchOutcome =
	| { readonly queryKey: QueryKey; readonly ok: true; readonly headers?: Readonly<Record<string, string>> }
	| { readonly queryKey: QueryKey; readonly ok: false; readonly failure: PrefetchFailure };

/** Aggregate result of a batch of prefetches. */
export interface PrefetchBatchResult {
	readonly outcomes: readonly PrefetchOutcome[];
	readonly succeeded: number;
	readonly failed: number;
	readonly skipped: number;
}

/** Per-page summary of the SSR prefetch pass — ideal for logging or a degraded-data note. */
export interface PrefetchReport {
	readonly page?: string;
	readonly total: number;
	readonly succeeded: number;
	readonly failed: number;
	readonly skipped: number;
	readonly outcomes: readonly PrefetchOutcome[];
	readonly durationMs: number;
	/** Byte size of the dehydrated payload after the budget was applied. */
	readonly payloadBytes: number;
}

/** `prefetchPage` result — hydrate `state`, observe `report`. */
export interface PrefetchPageResult {
	readonly state: ReturnType<typeof dehydrate>;
	readonly report: PrefetchReport;
	readonly queryClient: QueryClient;
}

export interface PrefetchPageOptions {
	readonly config?: Partial<ServerApiConfig>;
	readonly signal?: AbortSignal;
	/** Post-dehydrate payload guard — drop the largest queries until under budget (bytes). */
	readonly maxPayloadBytes?: number;
	/** Reuse a client instead of creating one (e.g. a layout-wide shared client). */
	readonly queryClient?: QueryClient;
	/** Route tag included in log events + the report. */
	readonly page?: string;
	/** Cap how many prefetches run at once (avoids stampeding the API). */
	readonly maxConcurrency?: number;
	/** Hard cap for the WHOLE batch; slower prefetches are aborted after this. */
	readonly deadlineMs?: number;
	/** Correlation id threaded into every log event. */
	readonly traceId?: string;
}

/** The parsed data behind a successful prefetch — carried by the in-flight dedupe. */
export interface PrefetchDetailedResult<Resp extends JsonValue> {
	readonly outcome: PrefetchOutcome;
	/** The validated payload when `ok` — present so sibling clients can seed their cache. */
	readonly data?: Resp;
}

// ── The tRPC-style server caller ───────────────────────────────────────────

/** One GET leaf on the caller: callable as a spec factory, plus `.query()` and `.prefetch()`. */
export interface ServerQueryLeaf<Input extends SerializableInput, Resp extends JsonValue> {
	/**
	 * Builds a `PrefetchSpec` for `prefetchPage`. The input is REQUIRED (pass
	 * `undefined` for no-input procedures) so a missing arg is a type error —
	 * same contract as the client's `useQuery(input)`.
	 */
	(input: Input, specOptions?: PrefetchSpecOptions<Resp>): PrefetchSpec;
	/** Direct server-side query — returns the parsed payload (no cache involved). */
	query(input: Input, call?: Omit<PrefetchCallOptions<Resp>, "fallbackData" | "captureHeaders" | "page" | "traceId">): Promise<Resp>;
	/** One-shot prefetch into a `QueryClient`. */
	prefetch(queryClient: QueryClient, input: Input, call?: PrefetchCallOptions<Resp>): Promise<PrefetchOutcome>;
}

/** One mutation leaf on the caller — direct server-side `.mutate()`. */
export interface ServerMutationLeaf<Input extends SerializableInput, Resp extends JsonValue> {
	mutate(input: Input): Promise<Resp>;
}

/** Recursive mapped type over `apiRouter` — every leaf becomes a caller leaf. */
export type ServerCallerTree<R> = {
	[K in keyof R]: R[K] extends QueryDef<infer Input, infer Resp>
		? ServerQueryLeaf<Input, Resp>
		: R[K] extends MutationDef<infer Input, infer Resp>
			? ServerMutationLeaf<Input, Resp>
			: ServerCallerTree<R[K]>;
};

export type ServerCaller = ServerCallerTree<ApiRouter>;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Type-safe query-value coercion — matches the client's `String(value)` semantics. */
export function coerceQueryValue(value: string | number | boolean): string {
	if (typeof value === "boolean") return value ? "true" : "false";
	return String(value);
}

/** Deterministic string form of a query key (dedupe map + duplicate detection). */
export function queryKeyString(key: QueryKey): string {
	return JSON.stringify(key);
}

/** Merges caller signals into one via `AbortSignal.any`. */
function mergeSignals(callers: readonly (AbortSignal | undefined)[]): AbortSignal | undefined {
	const present: AbortSignal[] = callers.filter((signal): signal is AbortSignal => signal !== undefined);
	if (present.length === 0) return undefined;
	if (present.length === 1) return present[0];
	return AbortSignal.any(present);
}

/** Forwards the incoming request's device/client headers so server captures carry context. */
async function getForwardedHeaders(): Promise<Readonly<Record<string, string>>> {
	try {
		const requestHeaders = await headers();
		const forwarded: Record<string, string> = {};
		const userAgent: string | null = requestHeaders.get("user-agent");
		const acceptLanguage: string | null = requestHeaders.get("accept-language");
		if (userAgent !== null) forwarded["user-agent"] = userAgent;
		if (acceptLanguage !== null) forwarded["accept-language"] = acceptLanguage;
		return forwarded;
	} catch {
		return {};
	}
}

/** Human-readable one-liner for a classified failure (logs + UI). */
export function describeFailure(failure: PrefetchFailure): string {
	switch (failure.kind) {
		case "no-cookie":
			return "no access-token cookie";
		case "unreachable":
			return `network (${failure.cause})`;
		case "http":
			return `HTTP ${String(failure.status)}`;
		case "schema":
			return `schema (${failure.message})`;
		case "timeout":
			return "timed out";
		case "aborted":
			return "aborted";
	}
}

/** Type guard for `PrefetchFailure` — useful when handling external payloads. */
export function isPrefetchFailure(value: object): value is PrefetchFailure {
	const kinds: ReadonlySet<string> = new Set(["no-cookie", "unreachable", "http", "schema", "timeout", "aborted"]);
	return "kind" in value && typeof value.kind === "string" && kinds.has(value.kind);
}

class PrefetchHttpError extends Error {
	public readonly status: number;
	public constructor(status: number) {
		super(`HTTP ${String(status)}`);
		this.name = "PrefetchHttpError";
		this.status = status;
	}
}

class PrefetchTimeoutError extends Error {
	public constructor() {
		super("timeout");
		this.name = "PrefetchTimeoutError";
	}
}

class PrefetchAbortError extends Error {
	public constructor() {
		super("aborted");
		this.name = "PrefetchAbortError";
	}
}

class PrefetchNoCookieError extends Error {
	public constructor() {
		super("no access-token cookie");
		this.name = "PrefetchNoCookieError";
	}
}

class PrefetchNetworkError extends Error {
	public constructor(cause: string) {
		super(cause);
		this.name = "PrefetchNetworkError";
	}
}

/** Classifies any thrown value into the `PrefetchFailure` union. */
export function classifyError(error: Error | string): PrefetchFailure {
	if (error instanceof PrefetchHttpError) return { kind: "http", status: error.status };
	if (error instanceof PrefetchTimeoutError) return { kind: "timeout" };
	if (error instanceof PrefetchAbortError) return { kind: "aborted" };
	if (error instanceof z.ZodError) {
		const firstIssue: { readonly path: readonly (string | number | symbol)[] } | undefined = error.issues[0];
		const path: string = firstIssue === undefined ? "" : firstIssue.path.join(".");
		return { kind: "schema", message: path.length > 0 ? `${path}: ${error.message}` : error.message };
	}
	if (error instanceof Error && error.name === "AbortError") return { kind: "aborted" };
	if (error instanceof Error) return { kind: "unreachable", cause: error.message };
	return { kind: "unreachable", cause: error };
}

/**
 * Dev-mode guard: warn when a def's computed key falls back to the legacy
 * `[method, path]` shape — that usually means the registry author forgot a
 * real `queryKey`, and server/client keys can drift silently (hydration would
 * just not match). All router defs define explicit builders, so this is a
 * tripwire for future additions, not a runtime check.
 */
export function assertKeyShape<Input extends SerializableInput, Resp extends JsonValue>(def: QueryDef<Input, Resp>, key: QueryKey): void {
	const isFallback: boolean = Array.isArray(key) && key.length === 2 && key[0] === "GET" && key[1] === def.path;
	if (isFallback && process.env.NODE_ENV !== "production") {
		console.warn(`[api-server] ${def.path} has no explicit queryKey — hydration may not match the client`);
	}
}

/** A `QueryClient` pre-tuned for SSR prefetching (same defaults as the pipeline). */
export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: DEFAULT_SERVER_API_CONFIG.staleTimeMs,
				gcTime: DEFAULT_SERVER_API_CONFIG.gcTimeMs,
				retry: 0,
			},
		},
	});
}

// ── RxJS fetch pipeline ─────────────────────────────────────────────────────

/**
 * One fetch as an RxJS observable. `defer` makes the fetch lazy AND re-runnable
 * (each `retry` resubscription re-executes it with the current token), and
 * `from(fetch(...))` bridges the promise. Errors are mapped to typed markers
 * (`PrefetchHttpError` / network / abort) for classification downstream.
 */
function createFetchObservable(
	url: string,
	extraHeaders: Readonly<Record<string, string>> | undefined,
	config: ServerApiConfig,
	token: () => string,
	forwarded: Readonly<Record<string, string>>,
	contextSignal?: AbortSignal,
): Observable<Response> {
	return defer(() => {
		const headers: Record<string, string> = {
			Accept: "application/json",
			Cookie: `${encodeURIComponent(config.accessTokenCookie)}=${encodeURIComponent(token())}`,
			"X-Client-Type": config.clientType,
			...forwarded,
			...extraHeaders,
		};
		const signal: AbortSignal | undefined = mergeSignals([contextSignal, AbortSignal.timeout(config.timeoutMs)]);
		const fetchImpl: typeof fetch = config.fetchImpl ?? globalThis.fetch;
		return from(
			fetchImpl(url, {
				method: "GET",
				headers,
				...(signal === undefined ? {} : { signal }),
				cache: "no-store",
			}),
		).pipe(
			catchError((error: Error | string) => {
				if (error instanceof Error && error.name === "AbortError") {
					return throwError(() => new PrefetchAbortError());
				}
				return throwError(() => new PrefetchNetworkError(error instanceof Error ? error.message : error));
			}),
			mergeMap((response: Response) => (response.ok ? of(response) : throwError(() => new PrefetchHttpError(response.status)))),
		);
	});
}

/** Reads the requested header names off a response (missing ones are skipped). */
function captureResponseHeaders(response: Response, names: readonly string[]): Readonly<Record<string, string>> {
	const captured: Record<string, string> = {};
	for (const name of names) {
		const value: string | null = response.headers.get(name);
		if (value !== null) captured[name] = value;
	}
	return captured;
}

/** Exponential backoff with jitter for transient retries. */
function backoffDelay(attempt: number, config: ServerApiConfig): number {
	const base: number = config.retryDelayMs * Math.pow(2, Math.max(0, attempt - 1)) + config.retryBackoffMs * Math.random();
	return Math.round(base);
}

/**
 * Attempts a server-side silent refresh (POST /auth/refresh with the refresh
 * cookie + `X-Client-Type`), returning the NEW access-token value from the
 * response's Set-Cookie headers — or `null` when there's nothing to refresh or
 * the API refused. `getSetCookie` is exposed by undici/Next's fetch runtime.
 */
export async function refreshAccessToken(config: ServerApiConfig): Promise<string | null> {
	const cookieStore = await cookies();
	const refreshToken: string | undefined = cookieStore.get(config.refreshTokenCookie)?.value;
	if (refreshToken === undefined) return null;

	const url: URL = new URL(`${API_URL_PREFIX}${apiRouter.auth.refresh.path}`, API_BASE_URL);
	const fetchImpl: typeof fetch = config.fetchImpl ?? globalThis.fetch;
	try {
		const response: Response = await fetchImpl(url, {
			method: "POST",
			headers: {
				Accept: "application/json",
				Cookie: `${encodeURIComponent(config.refreshTokenCookie)}=${encodeURIComponent(refreshToken)}`,
				"X-Client-Type": config.clientType,
			},
			cache: "no-store",
		});
		if (!response.ok) return null;
		const setCookies: readonly string[] = response.headers.getSetCookie();
		const accessCookie: string | undefined = setCookies.find((cookie) => cookie.startsWith(`${config.accessTokenCookie}=`));
		if (accessCookie === undefined) return null;
		const value: string = accessCookie.split(";")[0] ?? "";
		return decodeURIComponent(value.slice(config.accessTokenCookie.length + 1));
	} catch {
		return null;
	}
}

/**
 * The full observable pipeline for one procedure: fetch → transient retries →
 * one refresh-on-401 retry (opt-out per spec) → deadline → schema parse.
 * Resolves with `{ raw, headers }` or THROWS a classified `PrefetchFailure`.
 * Consumers use `firstValueFrom`, which auto-unsubscribes — no manual cleanup.
 */
function createPrefetchObservable<Input extends SerializableInput, Resp extends JsonValue>(
	def: QueryDef<Input, Resp>,
	input: Input,
	extraHeaders: Readonly<Record<string, string>> | undefined,
	config: ServerApiConfig,
	token: () => string,
	applyToken: (fresh: string) => void,
	forwarded: Readonly<Record<string, string>>,
	contextSignal: AbortSignal | undefined,
	allowRefresh: boolean,
	captureHeaders: readonly string[],
): Observable<{ readonly raw: Resp; readonly headers: Readonly<Record<string, string>> }> {
	// A leaf pinned to a non-default version (`def.version`) builds `/api/v2/...`
	// — identical URL derivation to the client transport, so prefetch and
	// client hydration always target the same route.
	const prefix: string = def.version === undefined ? API_URL_PREFIX : apiVersionPrefix(def.version);
	const url: string = new URL(`${prefix}${resolveRequest(def.path, input).url}`, API_BASE_URL).toString();
	const source: Observable<Response> = createFetchObservable(url, { ...def.baseOptions?.headers, ...extraHeaders }, config, token, forwarded, contextSignal);

	return source.pipe(
		// Transient (network) retries with exponential backoff + jitter — 0 by
		// default so SSR fails fast.
		retry({
			count: config.retries,
			delay: (error: Error | string, attempt: number) => (error instanceof PrefetchNetworkError ? timer(backoffDelay(attempt, config)) : throwError(() => error)),
		}),
		// One silent-refresh retry on 401 (token rotation; the `retry` delay
		// performs the refresh and only emits when a fresh token landed).
		retry({
			count: allowRefresh ? 1 : 0,
			delay: (error: Error | string) => {
				if (!(error instanceof PrefetchHttpError) || error.status !== 401) {
					return throwError(() => error);
				}
				return from(refreshAccessToken(config)).pipe(
					mergeMap((fresh: string | null) => {
						if (fresh === null) return throwError(() => error);
						applyToken(fresh); // the retried fetch re-reads the rotated token
						return of(fresh);
					}),
					map(() => undefined),
				);
			},
		}),
		// Hard deadline for the whole attempt.
		timeout({ each: config.timeoutMs, with: () => throwError(() => new PrefetchTimeoutError()) }),
		mergeMap((response: Response) =>
			from(response.json()).pipe(
				map((raw: JsonValue): { readonly raw: JsonValue; readonly headers: Readonly<Record<string, string>> } => ({
					raw,
					headers: captureResponseHeaders(response, captureHeaders),
				})),
			),
		),
		map(({ raw, headers: captured }): { readonly raw: Resp; readonly headers: Readonly<Record<string, string>> } => ({
			raw: def.responseSchema.parse(raw),
			headers: captured,
		})),
	);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Prefetches one GET procedure into the passed `QueryClient` (default admin
 * config). Never throws: returns a `PrefetchOutcome`. A failed prefetch leaves
 * the query in `error` state, and `dehydrate` only serializes `success`
 * queries — so failures never reach the client, and the view's own `useQuery`
 * runs normally.
 */
export function prefetchEndpoint<Input extends SerializableInput, Resp extends JsonValue>(
	queryClient: QueryClient,
	def: QueryDef<Input, Resp>,
	input: Input,
	call?: Omit<PrefetchCallOptions<Resp>, "fallbackData" | "captureHeaders" | "page" | "traceId">,
): Promise<PrefetchOutcome> {
	return prefetchEndpointDetailed(queryClient, def, input, DEFAULT_SERVER_API_CONFIG, call).then((detailed) => detailed.outcome);
}

/** Web-app convenience: same as `prefetchEndpoint` with the web cookie set. */
export function prefetchWebEndpoint<Input extends SerializableInput, Resp extends JsonValue>(
	queryClient: QueryClient,
	def: QueryDef<Input, Resp>,
	input: Input,
	call?: Omit<PrefetchCallOptions<Resp>, "fallbackData" | "captureHeaders" | "page" | "traceId">,
): Promise<PrefetchOutcome> {
	return prefetchEndpointDetailed(queryClient, def, input, DEFAULT_WEB_SERVER_API_CONFIG, call).then((detailed) => detailed.outcome);
}

/**
 * The core prefetch: runs one procedure with an explicit config and also
 * resolves the parsed data so sibling QueryClients (cross-render dedupe) can
 * seed their cache.
 *
 * Never throws: returns a `PrefetchDetailedResult` (outcome + optional data).
 */
export async function prefetchEndpointDetailed<Input extends SerializableInput, Resp extends JsonValue>(
	queryClient: QueryClient,
	def: QueryDef<Input, Resp>,
	input: Input,
	config: ServerApiConfig,
	call?: PrefetchCallOptions<Resp>,
): Promise<PrefetchDetailedResult<Resp>> {
	// Key from the RAW input — the client view computes its useQuery key from
	// the same raw input, so hydration binds even when the schema applies
	// defaults (e.g. `sort: "newest"`). Parsing happens inside the fetch so
	// validation failures classify as `schema` failures instead of breaking the
	// key contract.
	const queryKey: QueryKey = def.queryKey(input);

	// Cross-render dedupe: two concurrent renders (different QueryClients)
	// sharing a queryKey reuse ONE upstream fetch. TanStack only dedupes within
	// a single client; this dedupes across clients/module instances. `Resp`
	// extends `JsonValue`, so the map can hold every endpoint's result without
	// erasing the data type.
	const dedupeKey: string = queryKeyString(queryKey);
	const inFlight: Promise<PrefetchDetailedResult<JsonValue>> | undefined = inFlightFetches.get(dedupeKey);
	if (inFlight !== undefined) {
		const shared: PrefetchDetailedResult<JsonValue> = await inFlight;
		if (shared.outcome.ok && shared.data !== undefined && queryClient.getQueryData(queryKey) === undefined) {
			queryClient.setQueryData(queryKey, shared.data);
		}
		// Callers only consume `outcome`, so the shared (widened) data is not
		// propagated — the cache seeding above is its only use.
		return { outcome: shared.outcome };
	}

	const promise: Promise<PrefetchDetailedResult<Resp>> = prefetchEndpointInternal(queryClient, def, input, queryKey, config, call);
	inFlightFetches.set(dedupeKey, promise);
	try {
		return await promise;
	} finally {
		inFlightFetches.delete(dedupeKey);
	}
}

/** The actual prefetch work — the dedupe wrapper above routes around it. */
async function prefetchEndpointInternal<Input extends SerializableInput, Resp extends JsonValue>(
	queryClient: QueryClient,
	def: QueryDef<Input, Resp>,
	input: Input,
	queryKey: QueryKey,
	config: ServerApiConfig,
	call?: PrefetchCallOptions<Resp>,
): Promise<PrefetchDetailedResult<Resp>> {
	const startedAt: number = Date.now();
	assertKeyShape(def, queryKey);

	const cookieStore = await cookies();
	const accessToken: string | undefined = cookieStore.get(config.accessTokenCookie)?.value;
	if (accessToken === undefined) {
		if (call?.fallbackData !== undefined) queryClient.setQueryData(queryKey, call.fallbackData);
		const outcome: PrefetchOutcome = { queryKey, ok: false, failure: { kind: "no-cookie" } };
		return { outcome };
	}

	const forwarded: Readonly<Record<string, string>> = await getForwardedHeaders();

	try {
		// tRPC-style input validation at the fetch boundary — a bad input is a
		// `schema` failure, not a crash. `fetchQuery` throws on failure (unlike
		// `prefetchQuery`) so the try/catch below classifies it; `retry: 0`
		// keeps TanStack from adding retries on top of the RxJS pipeline.
		const parsed: Input = def.inputSchema.parse(input);
		let currentToken: string = accessToken;
		let capturedHeaders: Readonly<Record<string, string>> | undefined;
		const data: Resp = await queryClient.fetchQuery({
			queryKey,
			staleTime: config.staleTimeMs,
			gcTime: config.gcTimeMs,
			retry: 0,
			queryFn: ({ signal: contextSignal }) => {
				// Merge every abort source: the batch/page signal, the query
				// context signal, and the per-call option signal.
				const mergedSignal: AbortSignal | undefined = mergeSignals([call?.signal, contextSignal]);
				return firstValueFrom(
					createPrefetchObservable(
						def,
						parsed,
						call?.headers,
						config,
						() => currentToken,
						(fresh: string): void => {
							currentToken = fresh;
						},
						forwarded,
						mergedSignal,
						call?.allowRefresh ?? true,
						call?.captureHeaders ?? [],
					),
				).then(({ raw, headers }): Resp => {
					capturedHeaders = headers;
					return raw;
				});
			},
		});
		const outcome: PrefetchOutcome = capturedHeaders === undefined ? { queryKey, ok: true } : { queryKey, ok: true, headers: capturedHeaders };
		config.logger({ queryKey, path: def.path, durationMs: Date.now() - startedAt, outcome, page: call?.page, traceId: call?.traceId });
		return { outcome, data };
	} catch (error) {
		const failure: PrefetchFailure = classifyError(error instanceof Error ? error : String(error));
		if (call?.fallbackData !== undefined) queryClient.setQueryData(queryKey, call.fallbackData);
		const outcome: PrefetchOutcome = { queryKey, ok: false, failure };
		config.logger({ queryKey, path: def.path, durationMs: Date.now() - startedAt, outcome, page: call?.page, traceId: call?.traceId });
		return { outcome };
	}
}

/** Direct server-side query (no cache) — the caller's `.query()`. */
async function queryServerData<Input extends SerializableInput, Resp extends JsonValue>(
	def: QueryDef<Input, Resp>,
	input: Input,
	config: ServerApiConfig,
	call?: PrefetchCallOptions<Resp>,
): Promise<Resp> {
	const parsed: Input = def.inputSchema.parse(input);
	const cookieStore = await cookies();
	const accessToken: string | undefined = cookieStore.get(config.accessTokenCookie)?.value;
	if (accessToken === undefined) throw new PrefetchNoCookieError();

	const forwarded: Readonly<Record<string, string>> = await getForwardedHeaders();
	let currentToken: string = accessToken;
	const { raw } = await firstValueFrom(
		createPrefetchObservable(
			def,
			parsed,
			call?.headers,
			config,
			() => currentToken,
			(fresh: string): void => {
				currentToken = fresh;
			},
			forwarded,
			call?.signal,
			call?.allowRefresh ?? true,
			call?.captureHeaders ?? [],
		),
	);
	return raw;
}

/** Direct server-side mutation (no cache) — the caller's `.mutate()`. */
async function mutateServerData<Input extends SerializableInput, Resp extends JsonValue>(def: MutationDef<Input, Resp>, input: Input, config: ServerApiConfig): Promise<Resp> {
	const parsed: Input = def.inputSchema.parse(input);
	const { url, body } = resolveRequest(def.path, parsed, { method: def.method, toQuery: def.toQuery });
	const finalBody: JsonValue = def.toBody !== undefined ? def.toBody(parsed) : (body ?? {});
	const prefix: string = def.version === undefined ? API_URL_PREFIX : apiVersionPrefix(def.version);

	const cookieStore = await cookies();
	const accessToken: string | undefined = cookieStore.get(config.accessTokenCookie)?.value;
	const headers: Record<string, string> = { Accept: "application/json", "X-Client-Type": config.clientType, ...def.baseOptions?.headers };
	if (accessToken !== undefined) headers.Cookie = `${encodeURIComponent(config.accessTokenCookie)}=${encodeURIComponent(accessToken)}`;

	const fetchImpl: typeof fetch = config.fetchImpl ?? globalThis.fetch;
	const response: Response = await fetchImpl(new URL(`${prefix}${url}`, API_BASE_URL), {
		method: def.method,
		headers,
		body: JSON.stringify(finalBody),
		cache: "no-store",
	});
	if (!response.ok) throw new PrefetchHttpError(response.status);
	return def.responseSchema.parse(await response.json());
}

/**
 * Builds the caller leaf for one GET def. The returned function IS the spec
 * factory — the def + input are captured in the `run` closure, so `PrefetchSpec`
 * needs no erased types.
 */
function createServerQueryLeaf<Input extends SerializableInput, Resp extends JsonValue>(def: QueryDef<Input, Resp>, config: ServerApiConfig): ServerQueryLeaf<Input, Resp> {
	const specFactory = (input: Input, specOptions?: PrefetchSpecOptions<Resp>): PrefetchSpec => {
		const specConfig: ServerApiConfig = specOptions?.config === undefined ? config : { ...config, ...specOptions.config };
		return {
			run: (queryClient: QueryClient, call?: PrefetchCallOptions): Promise<PrefetchOutcome> =>
				prefetchEndpointDetailed(queryClient, def, input, specConfig, {
					signal: call?.signal,
					page: call?.page,
					traceId: call?.traceId,
					allowRefresh: specOptions?.allowRefresh,
					fallbackData: specOptions?.fallbackData,
					captureHeaders: specOptions?.captureHeaders,
					headers: specOptions?.headers,
				}).then((detailed) => detailed.outcome),
			queryKey: def.queryKey(input),
			enabled: specOptions?.enabled,
		};
	};
	return Object.assign(specFactory, {
		query: (input: Input, call?: Omit<PrefetchCallOptions<Resp>, "fallbackData" | "captureHeaders" | "page" | "traceId">): Promise<Resp> =>
			queryServerData(def, input, config, call),
		prefetch: (queryClient: QueryClient, input: Input, call?: PrefetchCallOptions<Resp>): Promise<PrefetchOutcome> =>
			prefetchEndpointDetailed(queryClient, def, input, config, call).then((detailed) => detailed.outcome),
	});
}

/** Builds the caller leaf for one mutation def — direct server-side `.mutate()`. */
function createServerMutationLeaf<Input extends SerializableInput, Resp extends JsonValue>(
	def: MutationDef<Input, Resp>,
	config: ServerApiConfig,
): ServerMutationLeaf<Input, Resp> {
	return {
		mutate: (input: Input): Promise<Resp> => mutateServerData(def, input, config),
	};
}

/**
 * Builds the tRPC-style server caller over `apiRouter` as a TYPED LITERAL —
 * every leaf is created with a generic call against the def, so `Input`/`Resp`
 * flow through inference. No runtime tree-walk, no casts. The `ServerCaller`
 * return annotation is the drift guard: a missing or mistyped leaf fails the
 * typecheck.
 *
 * ```ts
 * const server = createServerCaller();
 * const me = await server.auth.me.query(undefined);          // direct, parsed
 * await server.telescope.overview.prefetch(queryClient, { range: "15m" });
 * await server.telescope.prune.mutate({ force: true });      // server-side mutation
 * const spec = server.telescope.requests({ page: 1 });       // spec for prefetchPage
 * ```
 */
function buildServerCallerTree(config: ServerApiConfig): ServerCaller {
	return {
		auth: {
			me: createServerQueryLeaf(apiRouter.auth.me, config),
			sessionStatus: createServerQueryLeaf(apiRouter.auth.sessionStatus, config),
			login: createServerMutationLeaf(apiRouter.auth.login, config),
			adminLogin: createServerMutationLeaf(apiRouter.auth.adminLogin, config),
			signup: createServerMutationLeaf(apiRouter.auth.signup, config),
			refresh: createServerMutationLeaf(apiRouter.auth.refresh, config),
			logout: createServerMutationLeaf(apiRouter.auth.logout, config),
		},
		email: {
			previewList: createServerQueryLeaf(apiRouter.email.previewList, config),
			previewDetail: createServerQueryLeaf(apiRouter.email.previewDetail, config),
			previewSend: createServerMutationLeaf(apiRouter.email.previewSend, config),
			logList: createServerQueryLeaf(apiRouter.email.logList, config),
		},
		backup: {
			create: createServerMutationLeaf(apiRouter.backup.create, config),
			list: createServerQueryLeaf(apiRouter.backup.list, config),
			status: createServerQueryLeaf(apiRouter.backup.status, config),
			download: createServerMutationLeaf(apiRouter.backup.download, config),
			remove: createServerMutationLeaf(apiRouter.backup.remove, config),
			options: createServerQueryLeaf(apiRouter.backup.options, config),
			verify: createServerMutationLeaf(apiRouter.backup.verify, config),
			restore: createServerMutationLeaf(apiRouter.backup.restore, config),
			cancel: createServerMutationLeaf(apiRouter.backup.cancel, config),
		},
		telescope: {
			overview: createServerQueryLeaf(apiRouter.telescope.overview, config),
			requests: createServerQueryLeaf(apiRouter.telescope.requests, config),
			requestDetail: createServerQueryLeaf(apiRouter.telescope.requestDetail, config),
			requestSql: createServerQueryLeaf(apiRouter.telescope.requestSql, config),
			compare: createServerQueryLeaf(apiRouter.telescope.compare, config),
			sql: createServerQueryLeaf(apiRouter.telescope.sql, config),
			exceptions: createServerQueryLeaf(apiRouter.telescope.exceptions, config),
			exceptionDetail: createServerQueryLeaf(apiRouter.telescope.exceptionDetail, config),
			mail: createServerQueryLeaf(apiRouter.telescope.mail, config),
			jobs: createServerQueryLeaf(apiRouter.telescope.jobs, config),
			jobDetail: createServerQueryLeaf(apiRouter.telescope.jobDetail, config),
			schedules: createServerQueryLeaf(apiRouter.telescope.schedules, config),
			leaderboard: createServerQueryLeaf(apiRouter.telescope.leaderboard, config),
			trends: createServerQueryLeaf(apiRouter.telescope.trends, config),
			logs: createServerQueryLeaf(apiRouter.telescope.logs, config),
			alerts: createServerQueryLeaf(apiRouter.telescope.alerts, config),
			search: createServerQueryLeaf(apiRouter.telescope.search, config),
			users: createServerQueryLeaf(apiRouter.telescope.users, config),
			status: createServerQueryLeaf(apiRouter.telescope.status, config),
			webhookDeliveries: createServerQueryLeaf(apiRouter.telescope.webhookDeliveries, config),

			dump: createServerMutationLeaf(apiRouter.telescope.dump, config),
			setAnnotation: createServerMutationLeaf(apiRouter.telescope.setAnnotation, config),
			replay: createServerMutationLeaf(apiRouter.telescope.replay, config),
			runSchedule: createServerMutationLeaf(apiRouter.telescope.runSchedule, config),
			prune: createServerMutationLeaf(apiRouter.telescope.prune, config),
			clearAll: createServerMutationLeaf(apiRouter.telescope.clearAll, config),
			alertAck: createServerMutationLeaf(apiRouter.telescope.alertAck, config),
			alertSnooze: createServerMutationLeaf(apiRouter.telescope.alertSnooze, config),
			setExceptionStatus: createServerMutationLeaf(apiRouter.telescope.setExceptionStatus, config),
			retryJob: createServerMutationLeaf(apiRouter.telescope.retryJob, config),
		},
	};
}

export function createServerCaller(config?: Partial<ServerApiConfig>): ServerCaller {
	return buildServerCallerTree(resolveConfig(config));
}

// Cross-render in-flight dedupe: two concurrent page renders that share a
// queryKey reuse ONE upstream fetch (TanStack only dedupes within a single
// QueryClient; this dedupes across clients/module instances). Every endpoint's
// `Resp` extends `JsonValue`, so the widened map type needs no erasure.
const inFlightFetches = new Map<string, Promise<PrefetchDetailedResult<JsonValue>>>();

/** Resolves a spec's `enabled` (static boolean or per-batch function). */
function isEnabled(spec: PrefetchSpec): boolean {
	if (spec.enabled === undefined) return true;
	return typeof spec.enabled === "function" ? spec.enabled() : spec.enabled;
}

/** Runs `task` over `items` with at most `limit` concurrent workers. */
async function runWithConcurrency<T>(items: readonly T[], limit: number, task: (item: T) => Promise<PrefetchOutcome>): Promise<PrefetchOutcome[]> {
	const results: PrefetchOutcome[] = new Array<PrefetchOutcome>(items.length);
	let cursor = 0;
	const worker = async (): Promise<void> => {
		for (;;) {
			const index: number = cursor;
			cursor += 1;
			const item: T | undefined = items[index];
			if (item === undefined) return;
			results[index] = await task(item);
		}
	};
	const workers: readonly Promise<void>[] = Array.from({ length: Math.min(limit, items.length) }, () => worker());
	await Promise.all(workers);
	return results;
}

/**
 * Prefetches a batch of specs into one `QueryClient` and returns the aggregate
 * result. TanStack Query dedupes concurrent identical `queryKey`s itself, so
 * two specs targeting the same endpoint share a single upstream fetch — and the
 * module-level in-flight map dedupes across concurrent page renders too.
 */
export async function prefetchBatch(queryClient: QueryClient, specs: readonly PrefetchSpec[], options?: PrefetchPageOptions): Promise<PrefetchBatchResult> {
	const enabled: readonly PrefetchSpec[] = specs.filter((spec) => isEnabled(spec));
	const skipped: number = specs.length - enabled.length;

	// Dev-mode tripwire: two enabled specs hitting the same key waste a fetch
	// (the dedupe map silently collapses them) — surface it during development.
	if (process.env.NODE_ENV !== "production") {
		const seen = new Set<string>();
		for (const spec of enabled) {
			const key: string = queryKeyString(spec.queryKey);
			if (seen.has(key)) {
				console.warn(`[api-server] duplicate queryKey in one batch: ${key}`);
			} else {
				seen.add(key);
			}
		}
	}

	const runSpec = (spec: PrefetchSpec): Promise<PrefetchOutcome> => spec.run(queryClient, { signal: options?.signal, page: options?.page, traceId: options?.traceId });

	const outcomes: PrefetchOutcome[] =
		options?.maxConcurrency !== undefined && options.maxConcurrency > 0
			? await runWithConcurrency(enabled, options.maxConcurrency, runSpec)
			: await Promise.all(enabled.map(runSpec));

	return {
		outcomes,
		succeeded: outcomes.filter((outcome) => outcome.ok).length,
		failed: outcomes.filter((outcome) => !outcome.ok).length,
		skipped,
	};
}

/** Drops the largest dehydrated queries until the serialized payload fits `maxBytes`. */
export function enforcePayloadBudget(state: ReturnType<typeof dehydrate>, maxBytes: number | undefined): ReturnType<typeof dehydrate> {
	if (maxBytes === undefined || state.queries.length === 0) return state;

	const sized: readonly { readonly query: ReturnType<typeof dehydrate>["queries"][number]; readonly bytes: number }[] = [...state.queries]
		.map((query) => ({ query, bytes: JSON.stringify(query).length }))
		.sort((a, b) => b.bytes - a.bytes);
	let used = 0;
	const kept: ReturnType<typeof dehydrate>["queries"] = sized
		.filter((entry) => {
			if (used + entry.bytes > maxBytes) return false;
			used += entry.bytes;
			return true;
		})
		.map((entry) => entry.query);
	return { ...state, queries: kept };
}

/**
 * The page-level SSR entry point: prefetches all specs, dehydrates, applies
 * the optional payload budget, and returns `{ state, report, queryClient }`.
 * Accepts either a flat spec array or a builder receiving the server caller
 * (tRPC-style — `(t) => [t.telescope.overview({ range }), t.auth.me(undefined)]`).
 * Pages wrap `state` in `<PrefetchBoundary>` (or `<HydrationBoundary>`).
 * Failures are logged (via config), optionally backfilled with `fallbackData`,
 * and simply not dehydrated — pages never see them.
 */
export async function prefetchPage(
	specs: readonly PrefetchSpec[] | ((server: ServerCaller) => readonly PrefetchSpec[]),
	options?: PrefetchPageOptions,
): Promise<PrefetchPageResult> {
	const server: ServerCaller = createServerCaller(options?.config);
	const resolved: readonly PrefetchSpec[] = typeof specs === "function" ? specs(server) : specs;

	const queryClient: QueryClient = options?.queryClient ?? createQueryClient();
	const startedAt: number = Date.now();
	const deadlineController: AbortController | undefined = options?.deadlineMs === undefined ? undefined : new AbortController();
	const deadlineTimer: ReturnType<typeof setTimeout> | undefined =
		deadlineController === undefined
			? undefined
			: setTimeout(() => {
					deadlineController.abort();
				}, options?.deadlineMs);
	const batch: PrefetchBatchResult = await prefetchBatch(queryClient, resolved, {
		...options,
		signal: mergeSignals([options?.signal, deadlineController?.signal]),
	});
	if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
	const state: ReturnType<typeof dehydrate> = enforcePayloadBudget(dehydrate(queryClient), options?.maxPayloadBytes);
	return {
		state,
		queryClient,
		report: {
			page: options?.page,
			total: batch.outcomes.length,
			succeeded: batch.succeeded,
			failed: batch.failed,
			skipped: batch.skipped,
			outcomes: batch.outcomes,
			durationMs: Date.now() - startedAt,
			payloadBytes: JSON.stringify(state).length,
		},
	};
}

/** Web-app page helper: `prefetchPage` with the web cookie set as the default config. */
export function prefetchWebPage(
	specs: readonly PrefetchSpec[] | ((server: ServerCaller) => readonly PrefetchSpec[]),
	options?: Omit<PrefetchPageOptions, "config">,
): Promise<PrefetchPageResult> {
	return prefetchPage(specs, { ...options, config: DEFAULT_WEB_SERVER_API_CONFIG });
}

/** Re-exports for convenience — the endpoint type consumers need for defs. */
export type { QueryDef, MutationDef, ProcedureDef };
