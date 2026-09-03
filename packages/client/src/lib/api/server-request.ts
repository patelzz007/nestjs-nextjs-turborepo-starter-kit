// ============================================
// lib/server-request.ts - SSR tRPC-style caller (procedure-first, no router deps)
// ============================================
import "server-only";

// Server twin of `api-request.ts`. Builds `.query()` / `.mutate()` leaves from
// any procedure router — same `resolveRequest` serializer as the client so SSR
// prefetch and client hydration share URLs and react-query keys.

import { type QueryKey } from "@tanstack/react-query";
import { apiVersionPrefix, type DataValue, type SerializableInput } from "@workspace/shared";
import { cookies, headers } from "next/headers";
import { catchError, defer, from, map, mergeMap, Observable, of, retry, throwError, timer, timeout, firstValueFrom } from "rxjs";
import { z } from "zod";

import { API_BASE_URL, API_URL_PREFIX } from "./config";
import {
	eachRouterEntry,
	isErasedProcedureDef,
	isRouterSubtree,
	resolveRequest,
	type MutationDef,
	type ProcedureDef,
	type QueryDef,
	type RouterTree,
	type RouterTreeValue,
} from "./endpoints";

// ── Config ─────────────────────────────────────────────────────────────────

export type ServerApiLogLevel = "silent" | "warn" | "info";

export interface ServerApiConfig {
	readonly accessTokenCookie: string;
	readonly refreshTokenCookie: string;
	readonly clientType: "web" | "admin" | "merchant";
	readonly staleTimeMs: number;
	readonly gcTimeMs: number;
	readonly timeoutMs: number;
	readonly retries: number;
	readonly retryDelayMs: number;
	readonly retryBackoffMs: number;
	readonly logger: (event: PrefetchLogEvent) => void;
	readonly logLevel: ServerApiLogLevel;
	readonly fetchImpl?: typeof fetch;
}

export const DEFAULT_SERVER_API_CONFIG: ServerApiConfig = {
	accessTokenCookie: "adminAccessToken",
	refreshTokenCookie: "adminRefreshToken",
	clientType: "admin",
	staleTimeMs: 60 * 1000,
	gcTimeMs: 5 * 60 * 1000,
	timeoutMs: 10_000,
	retries: 3,
	retryDelayMs: 500,
	retryBackoffMs: 250,
	logger: createDefaultLogger("warn"),
	logLevel: "warn",
};

export const DEFAULT_WEB_SERVER_API_CONFIG: ServerApiConfig = {
	...DEFAULT_SERVER_API_CONFIG,
	accessTokenCookie: "accessToken",
	refreshTokenCookie: "refreshToken",
	clientType: "web",
};

export const DEFAULT_MERCHANT_SERVER_API_CONFIG: ServerApiConfig = {
	...DEFAULT_SERVER_API_CONFIG,
	accessTokenCookie: "merchantAccessToken",
	refreshTokenCookie: "merchantRefreshToken",
	clientType: "merchant",
};

/**
 * Minimal mutation metadata required by the 401 refresh pipeline.
 *
 * Deliberately does not use ErasedMutationDef because the refresh pipeline
 * only needs the endpoint path/version. Keeping the full generic mutation
 * definition here causes function-parameter variance issues with queryKey.
 */
export interface RefreshMutationDef {
	readonly path: string;
	readonly version?: import("@workspace/shared").ApiVersion;
}

export interface ServerRequestContext {
	readonly config: ServerApiConfig;

	/** Procedure metadata used by the 401 refresh pipeline. */
	readonly refreshDef: RefreshMutationDef;
}

export function createServerRequestContext(
	config: ServerApiConfig,
	refreshDef: RefreshMutationDef,
): ServerRequestContext {
	return { config, refreshDef };
}

export function createDefaultLogger(logLevel: ServerApiLogLevel): (event: PrefetchLogEvent) => void {
	return (event): void => {
		if (logLevel === "silent") return;
		if (event.outcome.ok) return;
		console.warn(`[api-server] prefetch failed (${describeFailure(event.outcome.failure)}) for ${event.path}${event.page === undefined ? "" : ` (${event.page})`}`);
	};
}

export function resolveConfig(overrides: Partial<ServerApiConfig> | undefined): ServerApiConfig {
	const merged: ServerApiConfig = { ...DEFAULT_SERVER_API_CONFIG, ...overrides };
	if (overrides?.logger === undefined && overrides?.logLevel !== undefined && merged.logLevel !== DEFAULT_SERVER_API_CONFIG.logLevel) {
		return { ...merged, logger: createDefaultLogger(merged.logLevel) };
	}
	return merged;
}

// ── Public types ────────────────────────────────────────────────────────────

export interface PrefetchCallOptions<Resp extends DataValue = DataValue> {
	readonly signal?: AbortSignal;
	readonly allowRefresh?: boolean;
	readonly fallbackData?: Resp;
	readonly captureHeaders?: readonly string[];
	readonly headers?: Readonly<Record<string, string>>;
	readonly page?: string;
	readonly traceId?: string;
}

export interface PrefetchLogEvent {
	readonly queryKey: QueryKey;
	readonly path: string;
	readonly durationMs: number;
	readonly outcome: PrefetchOutcome;
	readonly page?: string;
	readonly traceId?: string;
}

export type PrefetchFailure =
	| { readonly kind: "no-cookie" }
	| { readonly kind: "unreachable"; readonly cause: string }
	| { readonly kind: "http"; readonly status: number }
	| { readonly kind: "schema"; readonly message: string }
	| { readonly kind: "timeout" }
	| { readonly kind: "aborted" };

export type PrefetchOutcome =
	| { readonly queryKey: QueryKey; readonly ok: true; readonly headers?: Readonly<Record<string, string>> }
	| { readonly queryKey: QueryKey; readonly ok: false; readonly failure: PrefetchFailure };

export interface ServerQueryLeaf<Input extends SerializableInput, Resp extends DataValue> {
	query(input: Input, call?: Omit<PrefetchCallOptions<Resp>, "fallbackData" | "captureHeaders" | "page" | "traceId">): Promise<Resp>;
}

export interface ServerMutationLeaf<Input extends SerializableInput, Resp extends DataValue> {
	mutate(input: Input): Promise<Resp>;
}

export type ServerCallerBranch<V> =
	V extends QueryDef<infer Input, infer Resp>
		? ServerQueryLeaf<Input, Resp>
		: V extends MutationDef<infer Input, infer Resp>
			? ServerMutationLeaf<Input, Resp>
			: V extends object
				? ServerCallerTree<V>
				: never;

export type ServerCallerTree<R extends object> = { [K in keyof R]: ServerCallerBranch<R[K]> };

// ── Helpers ────────────────────────────────────────────────────────────────

function mergeSignals(callers: readonly (AbortSignal | undefined)[]): AbortSignal | undefined {
	const present: AbortSignal[] = callers.filter((signal): signal is AbortSignal => signal !== undefined);
	if (present.length === 0) return undefined;
	if (present.length === 1) return present[0];
	return AbortSignal.any(present);
}

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

// ── RxJS fetch pipeline ─────────────────────────────────────────────────────

function createFetchObservable(
	url: string,
	extraHeaders: Readonly<Record<string, string>> | undefined,
	config: ServerApiConfig,
	token: () => string,
	forwarded: Readonly<Record<string, string>>,
	contextSignal?: AbortSignal,
): Observable<Response> {
	return defer(() => {
		const requestHeaders: Record<string, string> = {
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
				headers: requestHeaders,
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

function captureResponseHeaders(response: Response, names: readonly string[]): Readonly<Record<string, string>> {
	const captured: Record<string, string> = {};
	for (const name of names) {
		const value: string | null = response.headers.get(name);
		if (value !== null) captured[name] = value;
	}
	return captured;
}

function backoffDelay(attempt: number, config: ServerApiConfig): number {
	const base: number = config.retryDelayMs * Math.pow(2, Math.max(0, attempt - 1)) + config.retryBackoffMs * Math.random();
	return Math.round(base);
}

export async function refreshAccessToken(context: ServerRequestContext): Promise<string | null> {
	const { config, refreshDef } = context;
	const cookieStore = await cookies();
	const refreshToken: string | undefined = cookieStore.get(config.refreshTokenCookie)?.value;
	if (refreshToken === undefined) return null;

	const prefix: string = refreshDef.version === undefined ? API_URL_PREFIX : apiVersionPrefix(refreshDef.version);
	const url: URL = new URL(`${prefix}${refreshDef.path}`, API_BASE_URL);
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

function createPrefetchObservable<Input extends SerializableInput, Resp extends DataValue>(
	context: ServerRequestContext,
	def: QueryDef<Input, Resp>,
	input: Input,
	extraHeaders: Readonly<Record<string, string>> | undefined,
	token: () => string,
	applyToken: (fresh: string) => void,
	forwarded: Readonly<Record<string, string>>,
	contextSignal: AbortSignal | undefined,
	allowRefresh: boolean,
	captureHeaders: readonly string[],
): Observable<{ readonly raw: Resp; readonly headers: Readonly<Record<string, string>> }> {
	const { config } = context;
	const prefix: string = def.version === undefined ? API_URL_PREFIX : apiVersionPrefix(def.version);
	const url: string = new URL(`${prefix}${resolveRequest(def.path, input).url}`, API_BASE_URL).toString();
	const source: Observable<Response> = createFetchObservable(url, { ...def.baseOptions?.headers, ...extraHeaders }, config, token, forwarded, contextSignal);

	return source.pipe(
		retry({
			count: config.retries,
			delay: (error: Error | string, attempt: number) => (error instanceof PrefetchNetworkError ? timer(backoffDelay(attempt, config)) : throwError(() => error)),
		}),
		retry({
			count: allowRefresh ? 1 : 0,
			delay: (error: Error | string) => {
				if (!(error instanceof PrefetchHttpError) || error.status !== 401) {
					return throwError(() => error);
				}
				return from(refreshAccessToken(context)).pipe(
					mergeMap((fresh: string | null) => {
						if (fresh === null) return throwError(() => error);
						applyToken(fresh);
						return of(fresh);
					}),
					map(() => undefined),
				);
			},
		}),
		timeout({ each: config.timeoutMs, with: () => throwError(() => new PrefetchTimeoutError()) }),
		mergeMap((response: Response) =>
			from(response.json()).pipe(
				map((raw: DataValue): { readonly raw: DataValue; readonly headers: Readonly<Record<string, string>> } => ({
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

// ── Procedure execution (tRPC-style) ───────────────────────────────────────

export async function fetchServerQuery<Input extends SerializableInput, Resp extends DataValue>(
	context: ServerRequestContext,
	def: QueryDef<Input, Resp>,
	input: Input,
	call?: PrefetchCallOptions<Resp>,
): Promise<Resp> {
	const parsed: Input = def.inputSchema.parse(input);
	const cookieStore = await cookies();
	const accessToken: string | undefined = cookieStore.get(context.config.accessTokenCookie)?.value;
	if (accessToken === undefined) throw new PrefetchNoCookieError();

	const forwarded: Readonly<Record<string, string>> = await getForwardedHeaders();
	let currentToken: string = accessToken;
	const { raw } = await firstValueFrom(
		createPrefetchObservable(
			context,
			def,
			parsed,
			call?.headers,
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

export async function fetchServerMutation<Input extends SerializableInput, Resp extends DataValue>(
	context: ServerRequestContext,
	def: MutationDef<Input, Resp>,
	input: Input,
): Promise<Resp> {
	const parsed: Input = def.inputSchema.parse(input);
	const { url, body } = resolveRequest(def.path, parsed, { method: def.method, toQuery: def.toQuery });
	const finalBody: DataValue = def.toBody !== undefined ? def.toBody(parsed) : (body ?? {});
	const prefix: string = def.version === undefined ? API_URL_PREFIX : apiVersionPrefix(def.version);
	const { config } = context;

	const cookieStore = await cookies();
	const accessToken: string | undefined = cookieStore.get(config.accessTokenCookie)?.value;
	const requestHeaders: Record<string, string> = { Accept: "application/json", "X-Client-Type": config.clientType, ...def.baseOptions?.headers };
	if (accessToken !== undefined) requestHeaders.Cookie = `${encodeURIComponent(config.accessTokenCookie)}=${encodeURIComponent(accessToken)}`;

	const fetchImpl: typeof fetch = config.fetchImpl ?? globalThis.fetch;
	const response: Response = await fetchImpl(new URL(`${prefix}${url}`, API_BASE_URL), {
		method: def.method,
		headers: requestHeaders,
		body: JSON.stringify(finalBody),
		cache: "no-store",
	});
	if (!response.ok) throw new PrefetchHttpError(response.status);
	return def.responseSchema.parse(await response.json());
}

export function createServerQueryLeaf<Input extends SerializableInput, Resp extends DataValue>(
	context: ServerRequestContext,
	def: QueryDef<Input, Resp>,
): ServerQueryLeaf<Input, Resp> {
	return {
		query: (input, call?): Promise<Resp> => fetchServerQuery(context, def, input, call),
	};
}

export function createServerMutationLeaf<Input extends SerializableInput, Resp extends DataValue>(
	context: ServerRequestContext,
	def: MutationDef<Input, Resp>,
): ServerMutationLeaf<Input, Resp> {
	return {
		mutate: (input): Promise<Resp> => fetchServerMutation(context, def, input),
	};
}

export function createServerProcedureLeaf<Input extends SerializableInput, Resp extends DataValue>(
	context: ServerRequestContext,
	def: ProcedureDef<Input, Resp>,
): ServerQueryLeaf<Input, Resp> | ServerMutationLeaf<Input, Resp> {
	if (def.kind === "query") {
		return createServerQueryLeaf(context, def);
	}
	return createServerMutationLeaf(context, def);
}

function isCompleteServerCaller<R extends object>(router: R, candidate: Partial<ServerCallerTree<R>>): candidate is ServerCallerTree<R> {
	let complete = true;
	eachRouterEntry(router, (key) => {
		if (candidate[key] === undefined) {
			complete = false;
		}
	});
	return complete;
}

function mapServerCallerBranch<V extends object>(
	context: ServerRequestContext,
	value: V,
): ServerCallerBranch<V> {
	if (isErasedProcedureDef(value)) {
		return createServerProcedureLeaf(
			context,
			value,
		) as ServerCallerBranch<V>;
	}

	if (isRouterSubtree(value)) {
		return createServerCallerForRouter(
			value,
			context,
		) as ServerCallerBranch<V>;
	}

	throw new Error(
		"Invalid router node — expected a procedure leaf or nested router.",
	);
}

function buildServerCallerTree<R extends object>(router: R, context: ServerRequestContext): ServerCallerTree<R> {
	const out: Partial<ServerCallerTree<R>> = {};

	eachRouterEntry(router, (key, value) => {
		out[key] = mapServerCallerBranch(
			context,
			value as Extract<R[typeof key], object>,
		) as ServerCallerTree<R>[typeof key];
	});

	if (!isCompleteServerCaller(router, out)) {
		throw new Error("Failed to build server caller — one or more router entries were not bound.");
	}

	return out;
}

/**
 * Walks a router tree and binds every leaf to a tRPC-style SSR caller.
 * `server.auth.me.query(undefined)` — no manual path/method wiring.
 */
export function createServerCallerForRouter<R extends object>(router: R, context: ServerRequestContext): ServerCallerTree<R> {
	return buildServerCallerTree(router, context);
}
