// ============================================
// lib/server-request.ts - SSR tRPC-style caller (procedure-first, no router deps)
// ============================================
import "server-only";

// Server twin of `api-request.ts`, READ-ONLY by design: it builds `.query()`
// leaves from any procedure router — same `resolveRequest` serializer as the
// client, so SSR prefetch and client hydration share URLs and react-query keys.
//
// What it deliberately does NOT do:
// - Rotate the session. A Server Component cannot write cookies, so a refresh
//   here would spend the refresh token (the API rotates it) without being able
//   to hand the new pair to the browser — the next browser request then
//   presents a superseded token and the session is revoked. Rotation happens
//   only where cookies can be written: the route proxy (`proxy.ts`, document
//   navigations) and the browser's single-flight refresh (`facade.tsx`). An
//   SSR 401 simply means "no prefetched data"; the client query fetches (and
//   refreshes) on mount.
// - Mutate. Writes belong to Server Actions / Route Handlers or the browser
//   client (mutation intent + Origin checks, audit, cookies). Mutation leaves
//   are absent from the server caller's type and runtime tree.

import {
	apiVersionPrefix,
	AUTH_COOKIE_NAMES,
	clientTypeHeader,
	type AuthClientType,
	type AuthCookieNamePair,
	type DataValue,
	type SerializableInput,
} from "@workspace/shared";
import { cookies, headers } from "next/headers";
import { catchError, defer, from, mergeMap, Observable, of, retry, throwError, timer, firstValueFrom } from "rxjs";
import { z } from "zod";

import { API_BASE_URL, API_URL_PREFIX } from "./config";
import { ApiResponseContractError, parseResponseText, type ApiResponseContractIssue } from "./response-contract";
import { eachRouterEntry, isErasedProcedureDef, isRouterSubtree, resolveRequest, type ErasedQueryDef, type MutationDef, type QueryDef, type RouterTree } from "./endpoints";

// ── Config ─────────────────────────────────────────────────────────────────

/** `warn` logs unexpected prefetch failures (see `isNoteworthyPrefetchFailure`); `silent` logs nothing. */
export type ServerApiLogLevel = "silent" | "warn";

export interface ServerApiConfig {
	/** Which frontend's isolated cookie set (and `X-Client-Type`) the caller forwards. */
	readonly clientType: AuthClientType;
	/** Budget for ONE fetch attempt. */
	readonly attemptTimeoutMs: number;
	/** Budget for the whole prefetch, retries and their backoff included. Must be ≥ `attemptTimeoutMs`. */
	readonly deadlineMs: number;
	/** Extra attempts after a network failure or an attempt timeout (never after an HTTP answer). */
	readonly retries: number;
	/** Backoff before the first retry; doubles per retry. */
	readonly retryDelayMs: number;
	/** Random 0..this added to each backoff so concurrent renders do not retry in lockstep. */
	readonly retryJitterMs: number;
	readonly logger: (event: PrefetchLogEvent) => void;
	readonly fetchImpl?: typeof fetch;
}

/** Overrides accepted by `resolveConfig`; `clientType` is always required — there is no default cookie set. */
export type ServerApiConfigInput = Partial<Omit<ServerApiConfig, "clientType">> & Pick<ServerApiConfig, "clientType"> & { readonly logLevel?: ServerApiLogLevel | undefined };

const DEFAULT_ATTEMPT_TIMEOUT_MS = 5_000;
const DEFAULT_DEADLINE_MS = 12_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_RETRY_JITTER_MS = 250;
const DEFAULT_LOG_LEVEL: ServerApiLogLevel = "warn";
const HTTP_UNAUTHORIZED = 401;

/** Library defaults for everything but the frontend's identity. */
export const DEFAULT_SERVER_API_CONFIG: Omit<ServerApiConfig, "clientType"> = {
	attemptTimeoutMs: DEFAULT_ATTEMPT_TIMEOUT_MS,
	deadlineMs: DEFAULT_DEADLINE_MS,
	retries: DEFAULT_RETRIES,
	retryDelayMs: DEFAULT_RETRY_DELAY_MS,
	retryJitterMs: DEFAULT_RETRY_JITTER_MS,
	logger: createDefaultLogger(DEFAULT_LOG_LEVEL),
};

export interface ServerRequestContext {
	readonly config: ServerApiConfig;
}

export function createServerRequestContext(config: ServerApiConfig): ServerRequestContext {
	return { config };
}

/**
 * Whether a prefetch failure deserves a log line. A guest with no cookie, an
 * access token that expired (the browser refreshes it) and an aborted render
 * are part of normal operation; everything else (API down, 5xx, 403/404,
 * contract drift, timeouts) is not.
 */
export function isNoteworthyPrefetchFailure(failure: PrefetchFailure): boolean {
	switch (failure.kind) {
		case "no-cookie":
		case "aborted":
			return false;
		case "http":
			return failure.status !== HTTP_UNAUTHORIZED;
		case "unreachable":
		case "schema":
		case "timeout":
			return true;
	}
}

export function createDefaultLogger(logLevel: ServerApiLogLevel): (event: PrefetchLogEvent) => void {
	return (event): void => {
		if (logLevel === "silent" || event.outcome.ok || !isNoteworthyPrefetchFailure(event.outcome.failure)) return;
		console.warn(`[api-server] prefetch failed (${describeFailure(event.outcome.failure)}) for ${event.path} after ${String(event.durationMs)}ms`);
	};
}

export function resolveConfig(input: ServerApiConfigInput): ServerApiConfig {
	const { logLevel, ...overrides } = input;
	const logger: (event: PrefetchLogEvent) => void = overrides.logger ?? (logLevel === undefined ? DEFAULT_SERVER_API_CONFIG.logger : createDefaultLogger(logLevel));
	const config: ServerApiConfig = { ...DEFAULT_SERVER_API_CONFIG, ...overrides, logger };
	if (config.deadlineMs < config.attemptTimeoutMs) {
		throw new Error(`Server API config: deadlineMs (${String(config.deadlineMs)}) must be at least attemptTimeoutMs (${String(config.attemptTimeoutMs)}).`);
	}
	return config;
}

// ── Public types ────────────────────────────────────────────────────────────

export interface PrefetchCallOptions {
	/** Aborts the prefetch (e.g. the render was cancelled). */
	readonly signal?: AbortSignal | undefined;
}

/** One finished prefetch, handed to `ServerApiConfig.logger`. */
export interface PrefetchLogEvent {
	readonly path: string;
	readonly durationMs: number;
	readonly outcome: PrefetchOutcome;
}

export type PrefetchFailure =
	| { readonly kind: "no-cookie" }
	| { readonly kind: "unreachable"; readonly cause: string }
	| { readonly kind: "http"; readonly status: number }
	| { readonly kind: "schema"; readonly message: string }
	| { readonly kind: "timeout" }
	| { readonly kind: "aborted" };

export type PrefetchOutcome = { readonly ok: true } | { readonly ok: false; readonly failure: PrefetchFailure };

export interface ServerQueryLeaf<Input extends SerializableInput, Resp extends DataValue> {
	query(input: Input, call?: PrefetchCallOptions): Promise<Resp>;
}

/** Router keys whose value is a mutation — excluded from the server caller. */
type MutationKeys<R extends object> = { [K in keyof R]-?: R[K] extends MutationDef<infer _Input, infer _Resp> ? K : undefined }[keyof R];

export type ServerCallerBranch<V> = V extends QueryDef<infer Input, infer Resp> ? ServerQueryLeaf<Input, Resp> : V extends object ? ServerCallerTree<V> : V;

/** The router tree with every query bound to a server leaf; mutations are not part of it. */
export type ServerCallerTree<R extends object> = { readonly [K in Exclude<keyof R, MutationKeys<R>>]: ServerCallerBranch<R[K]> };

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Request headers forwarded from the incoming browser request: the client's
 * user agent and language, and its address chain (`x-forwarded-for` — Next.js
 * sets it from the socket when no ingress did) so the API's audit trail and
 * rate limits see the member, not this server.
 */
const FORWARDED_REQUEST_HEADERS: readonly string[] = ["user-agent", "accept-language", "x-forwarded-for"];

function readForwardedHeaders(requestHeaders: Headers): Readonly<Record<string, string>> {
	const forwarded: Record<string, string> = {};
	for (const name of FORWARDED_REQUEST_HEADERS) {
		const value: string | null = requestHeaders.get(name);
		if (value !== null) forwarded[name] = value;
	}
	return forwarded;
}

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

const PrefetchFailureKindSchema = z.enum(["no-cookie", "unreachable", "http", "schema", "timeout", "aborted"]);

export function isPrefetchFailure(value: object): value is PrefetchFailure {
	return "kind" in value && PrefetchFailureKindSchema.safeParse(value.kind).success;
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

/** `AbortSignal.timeout()` rejects a fetch with a `TimeoutError`; an explicit abort with an `AbortError`. */
const TIMEOUT_ERROR_NAME = "TimeoutError";
const ABORT_ERROR_NAME = "AbortError";
/** The cause reported for a rejection that carried no `Error`. */
const UNCLASSIFIED_FAILURE_CAUSE = "non-Error rejection";

/** Classifies what a prefetch rejected with; anything that is not an `Error` is an unclassifiable failure. */
export function classifyError(error: Error | undefined): PrefetchFailure {
	if (error instanceof PrefetchNoCookieError) return { kind: "no-cookie" };
	if (error instanceof PrefetchHttpError) return { kind: "http", status: error.status };
	if (error instanceof PrefetchTimeoutError) return { kind: "timeout" };
	if (error instanceof PrefetchAbortError) return { kind: "aborted" };
	if (error instanceof ApiResponseContractError) {
		const firstIssue: ApiResponseContractIssue | undefined = error.issues[0];
		return { kind: "schema", message: firstIssue === undefined ? error.message : `${firstIssue.path}: ${firstIssue.message}` };
	}
	if (error instanceof z.ZodError) {
		const firstIssue: { readonly path: readonly PropertyKey[] } | undefined = error.issues[0];
		const path: string = firstIssue === undefined ? "" : firstIssue.path.map((segment: PropertyKey): string => String(segment)).join(".");
		return { kind: "schema", message: path.length > 0 ? `${path}: ${error.message}` : error.message };
	}
	if (error instanceof Error && error.name === TIMEOUT_ERROR_NAME) return { kind: "timeout" };
	if (error instanceof Error && error.name === ABORT_ERROR_NAME) return { kind: "aborted" };
	if (error instanceof Error) return { kind: "unreachable", cause: error.message };
	return { kind: "unreachable", cause: UNCLASSIFIED_FAILURE_CAUSE };
}

// ── RxJS fetch pipeline ─────────────────────────────────────────────────────

interface PrefetchRequest {
	readonly url: string;
	readonly headers: Readonly<Record<string, string>>;
	/** Fires when the whole prefetch's deadline passes or the caller aborts. */
	readonly signal: AbortSignal;
	readonly deadline: AbortSignal;
	readonly config: ServerApiConfig;
}

/** One GET attempt, bounded by its own timeout AND the prefetch's signal. */
function createAttemptObservable(request: PrefetchRequest): Observable<Response> {
	return defer(() => {
		const fetchImpl: typeof fetch = request.config.fetchImpl ?? globalThis.fetch;
		const signal: AbortSignal = AbortSignal.any([request.signal, AbortSignal.timeout(request.config.attemptTimeoutMs)]);
		return from(fetchImpl(request.url, { method: "GET", headers: request.headers, signal, cache: "no-store" })).pipe(
			catchError((error: Error | string) => {
				if (request.deadline.aborted) return throwError(() => new PrefetchTimeoutError());
				if (error instanceof Error && error.name === TIMEOUT_ERROR_NAME) return throwError(() => new PrefetchTimeoutError());
				if (error instanceof Error && error.name === ABORT_ERROR_NAME) return throwError(() => new PrefetchAbortError());
				return throwError(() => new PrefetchNetworkError(error instanceof Error ? error.message : error));
			}),
			mergeMap((response: Response) => (response.ok ? of(response) : throwError(() => new PrefetchHttpError(response.status)))),
		);
	});
}

function backoffDelay(attempt: number, config: ServerApiConfig): number {
	return Math.round(config.retryDelayMs * Math.pow(2, Math.max(0, attempt - 1)) + config.retryJitterMs * Math.random());
}

/** Network failures and attempt timeouts are retried while the deadline allows; an HTTP answer or an abort is final. */
function isRetryable(error: Error | string, request: PrefetchRequest): boolean {
	return !request.deadline.aborted && !request.signal.aborted && (error instanceof PrefetchNetworkError || error instanceof PrefetchTimeoutError);
}

function createPrefetchObservable<Resp extends DataValue>(request: PrefetchRequest, responseSchema: z.ZodType<Resp>): Observable<Resp> {
	return createAttemptObservable(request).pipe(
		retry({
			count: request.config.retries,
			delay: (error: Error | string, attempt: number) => (isRetryable(error, request) ? timer(backoffDelay(attempt, request.config)) : throwError(() => error)),
		}),
		mergeMap((response: Response) =>
			from(response.text()).pipe(
				// The one response-validation point of the SSR pipeline (ADR 022).
				mergeMap((text: string) => of(parseResponseText(responseSchema, text, { method: "GET", url: request.url, status: response.status }))),
			),
		),
	);
}

// ── Procedure execution (tRPC-style) ───────────────────────────────────────

function readSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, cookieNames: AuthCookieNamePair): string | undefined {
	return cookieStore.get(cookieNames.accessToken)?.value;
}

/**
 * Fetches one query on the server. Never refreshes the session (see the module
 * header): a 401 rejects like any other failure and the page renders without
 * the prefetched data. Every outcome is reported to `config.logger`, so a
 * caller that degrades on failure (`catch { return undefined }`) never hides it.
 */
export async function fetchServerQuery<Input extends SerializableInput, Resp extends DataValue>(
	context: ServerRequestContext,
	def: QueryDef<Input, Resp>,
	input: Input,
	call?: PrefetchCallOptions,
): Promise<Resp> {
	const { config } = context;
	const startedAt: number = Date.now();
	const report = (outcome: PrefetchOutcome): void => {
		config.logger({ path: def.path, durationMs: Date.now() - startedAt, outcome });
	};

	try {
		const parsed: Input = def.inputSchema.parse(input);
		const cookieNames: AuthCookieNamePair = AUTH_COOKIE_NAMES[config.clientType];
		const accessToken: string | undefined = readSessionCookie(await cookies(), cookieNames);
		// A route that needs a session is skipped without one (no pointless 401 round trip);
		// a public route is fetched anonymously — guests get server-rendered public data.
		if (accessToken === undefined && def.access !== "public") throw new PrefetchNoCookieError();

		const prefix: string = def.version === undefined ? API_URL_PREFIX : apiVersionPrefix(def.version);
		const deadline: AbortSignal = AbortSignal.timeout(config.deadlineMs);
		const resp: Resp = await firstValueFrom(
			createPrefetchObservable(
				{
					url: new URL(`${prefix}${resolveRequest(def.path, parsed).url}`, API_BASE_URL).toString(),
					headers: {
						...def.baseOptions?.headers,
						...readForwardedHeaders(await headers()),
						Accept: "application/json",
						...clientTypeHeader(config.clientType),
						// A public route fetched for a visitor with no session carries no cookie.
						...(accessToken === undefined ? {} : { Cookie: `${encodeURIComponent(cookieNames.accessToken)}=${encodeURIComponent(accessToken)}` }),
					},
					signal: call?.signal === undefined ? deadline : AbortSignal.any([call.signal, deadline]),
					deadline,
					config,
				},
				def.responseSchema,
			),
		);
		report({ ok: true });
		return resp;
	} catch (error) {
		report({ ok: false, failure: classifyError(error instanceof Error ? error : undefined) });
		throw error;
	}
}

export function createServerQueryLeaf<Input extends SerializableInput, Resp extends DataValue>(
	context: ServerRequestContext,
	def: QueryDef<Input, Resp>,
): ServerQueryLeaf<Input, Resp> {
	return {
		query: (input, call?): Promise<Resp> => fetchServerQuery(context, def, input, call),
	};
}

/** Erased build-time shape — widened so each router key can accept any branch variant. */
type ServerCallerTreeBuild<R extends object> = {
	[K in keyof R]?: ServerQueryLeaf<SerializableInput, DataValue> | ServerCallerTree<RouterTree>;
};

type ServerCallerNode = { readonly kind: "query"; readonly def: ErasedQueryDef } | { readonly kind: "mutation" } | { readonly kind: "router"; readonly router: RouterTree };

function classifyRouterNode(value: object): ServerCallerNode {
	if (isErasedProcedureDef(value)) {
		return value.kind === "query" ? { kind: "query", def: value } : { kind: "mutation" };
	}
	if (isRouterSubtree(value)) {
		return { kind: "router", router: value };
	}
	throw new Error("Invalid router node — expected a procedure leaf or nested router.");
}

/** Every non-mutation entry of `router` was bound (`boundKeys`) — narrows the build to the complete caller. */
function isCompleteServerCaller<R extends object>(
	router: R,
	candidate: ServerCallerTreeBuild<R> | ServerCallerTree<R>,
	boundKeys: ReadonlySet<string>,
): candidate is ServerCallerTree<R> {
	let complete = true;
	eachRouterEntry(router, (key, value) => {
		const isMutation: boolean = typeof value === "object" && value !== null && classifyRouterNode(value).kind === "mutation";
		if (!isMutation && !boundKeys.has(key)) {
			complete = false;
		}
	});
	return complete;
}

function buildServerCallerTree<R extends object>(router: R, context: ServerRequestContext): ServerCallerTree<R> {
	const out: ServerCallerTreeBuild<R> = {};
	const boundKeys = new Set<string>();

	eachRouterEntry(router, (key, value) => {
		if (typeof value !== "object" || value === null) {
			throw new Error("Invalid router node — expected a procedure leaf or nested router.");
		}
		const node: ServerCallerNode = classifyRouterNode(value);
		if (node.kind === "query") {
			out[key] = createServerQueryLeaf(context, node.def);
			boundKeys.add(key);
		} else if (node.kind === "router") {
			out[key] = buildServerCallerTree(node.router, context);
			boundKeys.add(key);
		}
		// Mutations are not bound: the server caller is read-only.
	});

	if (!isCompleteServerCaller(router, out, boundKeys)) {
		throw new Error("Failed to build server caller — one or more router entries were not bound.");
	}

	return out;
}

/**
 * Walks a router tree and binds every QUERY leaf to a tRPC-style SSR caller.
 * `server.auth.me.query(undefined)` — no manual path/method wiring.
 */
export function createServerCallerForRouter<R extends object>(router: R, context: ServerRequestContext): ServerCallerTree<R> {
	return buildServerCallerTree(router, context);
}
