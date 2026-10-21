// ============================================
// router.ts - Typed API router (tRPC-flavoured, REST under the hood)
// ============================================
// Pure module (zod schemas + plain procedure definitions — no hooks, no
// browser or Node APIs), deliberately NOT marked "use client": the same router
// is used by client screens for data fetching (the `./react` entry builds a
// client router from it), by the web SSR prefetch (`@workspace/client`'s
// `server-api.ts` builds a caller from it) and by the mobile app, so the
// definitions must be callable everywhere.
//
// The model is tRPC-like: every leaf is a procedure with a SINGLE typed input
// (zod-validated) and a typed response. "But not exactly tRPC": the
// transport is plain REST — the input maps onto a URL (path params + query
// string for GET, path params + JSON body for mutations) instead of a
// procedure-call envelope. `resolveRequest` is the single serializer shared
// by the client transport and the server prefetch pipeline.
//
// The route contract (method + path + input schema + response envelope) lives
// in `@workspace/shared` (`apiContract`) — this module derives every def from
// it, so the client router and the API's boundary validation can never drift.
// Only the client-side concerns stay here: the react-query cache scope and the
// serialization knobs (`toQuery` / `toBody`).
//
// The input/output type parameters are CONSTRAINED (`SerializableInput` /
// `DataValue`) so the shared pipeline (dedupe map, observable, spec closures)
// can be typed end-to-end with generics — no type erasure, no `unknown`,
// no casts anywhere.

import {
	apiContract,
	clientTypeHeader,
	flattenQueryParams,
	isBooleanPrimitive,
	isNumberPrimitive,
	isStringPrimitive,
	type ApiAccess,
	type ApiContractDef,
	type ApiVersion,
	type DataValue,
	type Envelope,
	type RestMethod,
	type SerializableInput,
} from "@workspace/shared";
import { z, ZodType } from "zod";

// Every endpoint answers with the ResponseInterceptor envelope
// ({ success: true, data, meta }). Its exact schema comes from the shared
// contract leaf (`response: singleResponse(…)` / `paginatedResponse(…)`,
// ADR 022) — the client never re-declares a response shape, and the fetch
// layer parses every body with it (`parseResponseContract`).

// ── Query keys ─────────────────────────────────────────────────────────────
//
// Keys are plain data (`ApiQueryKey`), with no TanStack import: the same key
// works with any TanStack Query adapter and in SSR hydration.
//
// Every query key is `[...scope, input]`: a SCOPE (the resource the data
// belongs to, e.g. `["tenant", tenantSlug, "kyb"]`) followed by the WHOLE
// parsed input. Two consequences, both by construction:
// - no input field can be left out of a key (no silently shared cache entries
//   between, say, two stores or two date ranges);
// - `def.scopeKey(scope)` is a prefix of every key the def produces for that
//   scope, so invalidating with it always reaches the cached queries.
// Code outside this module never writes a key by hand: it invalidates with
// `apiRouter.<…>.scopeKey(…)` (or `queryKey(input)` for one exact entry). The
// lint config rejects array literals as cache keys (docs/technical/tooling/eslint.md).

/**
 * One TanStack Query cache key: a scope followed by the parsed input. Assignable
 * to TanStack's `QueryKey`.
 */
export type ApiQueryKey = readonly DataValue[];

/**
 * A scope's fields. The index signature keeps every scope assignable to
 * `SerializableInput` (a scope is a slice of a query's input).
 */
type ScopeFields = Readonly<Record<string, DataValue | undefined>>;

/** Scope of every tenant-owned resource. */
export interface TenantScope extends ScopeFields {
	readonly tenantSlug: string;
}

/** Scope of one admin-managed tenant. */
export interface AdminTenantScope extends ScopeFields {
	readonly tenantId: string;
}

/** Scope of one configured GitHub repository. */
export interface GithubRepositoryScope extends ScopeFields {
	readonly owner: string;
	readonly repository: string;
}

/** Scope of one pull request: every view of it nests under this, so one invalidation reloads them all. */
export interface GithubPullRequestScope extends ScopeFields {
	readonly owner: string;
	readonly repository: string;
	readonly number: number;
}

/** First element of every pull-request query key: invalidating it reloads every pull-request view (after linking or unlinking). */
export const GITHUB_PULL_REQUESTS_QUERY_ROOT = "github-pull-requests";

/** The prefix of every pull-request key — invalidate it after the token is linked, replaced or removed. */
export function githubPullRequestsRootKey(): ApiQueryKey {
	return [GITHUB_PULL_REQUESTS_QUERY_ROOT];
}

/** The key of one repository's live-update status — set it from a turn-on/off answer. Names are compared as GitHub does, ignoring case. */
export function githubLiveUpdatesKey(owner: string, repository: string): ApiQueryKey {
	return [...githubPullRequestsRootKey(), "live-updates", owner.toLowerCase(), repository.toLowerCase()];
}

/** The key prefix shared by every view of one pull request — invalidate it after that pull request changes. */
export function githubPullRequestScopeKey({ owner, repository, number }: GithubPullRequestScope): ApiQueryKey {
	return [GITHUB_PULL_REQUESTS_QUERY_ROOT, "pull", owner, repository, number];
}

// ── Definition model (input-first, tRPC-style) ────────────────────────────

/** A GET procedure: input → path params + query string, response → typed payload. */
export interface QueryDef<Input extends SerializableInput, Resp extends DataValue> {
	readonly kind: "query";
	readonly method: "GET";
	/** Path template; `:name` segments are filled from the input. */
	readonly path: string;
	/**
	 * API version for this leaf — `undefined` means the current default
	 * (`API_VERSION`). Set from the shared contract (`defineContract({ version: "v2" })`)
	 * so the transport derives `/api/v2/<path>` and the query key is
	 * namespaced — server and client can never drift.
	 */
	readonly version?: ApiVersion | undefined;
	/**
	 * Who may call the route, from the contract (`"public"` = `@Public()` on the
	 * API). The SSR caller fetches a public route even without a session cookie.
	 */
	readonly access: ApiAccess;
	/** Single typed input, validated before every call (tRPC-style). */
	readonly inputSchema: ZodType<Input>;
	readonly responseSchema: ZodType<Resp>;
	/** Derives the react-query key from the (parsed) input — server and client MUST agree. */
	readonly queryKey: (input: Input) => ApiQueryKey;
	/**
	 * The cache scope of an input: a prefix of `queryKey(input)` and of every
	 * other key in the same scope — invalidate / read the cache with it.
	 * `ScopedQueryDef` narrows the parameter to just the scope's fields.
	 */
	readonly scopeKey: (scope: Input) => ApiQueryKey;
	readonly baseOptions?: { readonly headers?: Record<string, string> | undefined } | undefined;
}

/** A query def plus its invalidation prefix. */
export interface ScopedQueryDef<Input extends SerializableInput & Scope, Resp extends DataValue, Scope extends SerializableInput> extends QueryDef<Input, Resp> {
	/** Prefix of every key this def produces for `scope` — invalidate / read the cache with it. */
	readonly scopeKey: (scope: Scope) => ApiQueryKey;
}

/**
 * A POST/PUT/PATCH/DELETE procedure: input → path params + JSON body, response → typed payload.
 * Deliberately has no query key: a mutation is not cached, and a key built
 * from its input would copy tokens and personal data into the cache and the
 * DevTools.
 */
export interface MutationDef<Input extends SerializableInput, Resp extends DataValue> {
	readonly kind: "mutation";
	readonly method: Exclude<RestMethod, "GET">;
	readonly path: string;
	/** API version for this leaf — see `QueryDef.version`. */
	readonly version?: ApiVersion | undefined;
	readonly inputSchema: ZodType<Input>;
	readonly responseSchema: ZodType<Resp>;
	readonly baseOptions?: { readonly headers?: Record<string, string> | undefined } | undefined;
	/**
	 * Maps the input to the request body. Default: every input key not consumed
	 * by a `:param` segment or listed in `toQuery`.
	 */
	readonly toBody?: ((input: Input) => DataValue) | undefined;
	/** Input keys routed to the QUERY string instead of the body (e.g. `prune({ force })`). */
	readonly toQuery?: readonly string[] | undefined;
}

export type ProcedureDef<Input extends SerializableInput, Resp extends DataValue> = QueryDef<Input, Resp> | MutationDef<Input, Resp>;

/** Erased procedure defs — used when walking a router tree at runtime without per-leaf generics. */
export type ErasedQueryDef = QueryDef<SerializableInput, DataValue>;

export type ErasedMutationDef = MutationDef<SerializableInput, DataValue>;

export type ErasedProcedureDef = ErasedQueryDef | ErasedMutationDef;

/** Nested router record accepted by `createCaller` / `buildClientRouter`. */
export interface RouterTree {
	readonly [key: string]: RouterTreeValue;
}

export type RouterTreeValue = ErasedProcedureDef | RouterTree;

/** A def's schemas are real zod schemas — checked by class, never by an unchecked `z.custom()`. */
const ZodSchemaInstanceSchema = z.instanceof(ZodType);

const ProcedureLeafShapeSchema = z.discriminatedUnion("kind", [
	z.looseObject({
		kind: z.literal("query"),
		method: z.literal("GET"),
		path: z.string(),
		inputSchema: ZodSchemaInstanceSchema,
		responseSchema: ZodSchemaInstanceSchema,
	}),
	z.looseObject({
		kind: z.literal("mutation"),
		method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
		path: z.string(),
		inputSchema: ZodSchemaInstanceSchema,
		responseSchema: ZodSchemaInstanceSchema,
	}),
]);

/** Zod-backed guard — narrows to an erased procedure def without type assertions. */
export function isErasedProcedureDef(value: object): value is ErasedProcedureDef {
	return ProcedureLeafShapeSchema.safeParse(value).success;
}

/** Zod-backed guard — nested router branch (not a procedure leaf). */
export function isRouterSubtree(value: object): value is RouterTree {
	return !isErasedProcedureDef(value);
}

/** Every router node — a procedure def or a nested router — is a plain object (zod rejects arrays and functions). */
const RouterNodeSchema = z.object({});

/** Zod-backed guard — the value is a router node object (not a primitive, array or function). */
function isRouterNode<T>(value: T): value is T & object {
	return RouterNodeSchema.safeParse(value).success;
}

function isRouterTreeKey<R extends object>(router: R, key: string): key is keyof R & string {
	return Object.hasOwn(router, key);
}

/** Iterate a router's own keys with `key` / `value` pairs fully typed. */
export function eachRouterEntry<R extends object>(router: R, visit: <K extends keyof R & string>(key: K, value: R[K]) => void): void {
	for (const key in router) {
		if (isRouterTreeKey(router, key)) {
			visit(key, router[key]);
		}
	}
}

/** The nodes {@link mapRouterTree} bound: some keys of `R`, each mapped to a node. */
type MappedRouterTreeNodes<R extends object, TNode extends object> = { [K in keyof R]?: TNode };

/** What {@link mapRouterTree} returns: the bound nodes, plus every key it settled (bound or skipped on purpose). */
export interface MappedRouterTree<R extends object, TNode extends object> {
	readonly nodes: MappedRouterTreeNodes<R, TNode>;
	readonly settledKeys: ReadonlySet<string>;
}

/** How {@link mapRouterTree} binds each entry of a router tree. */
export interface RouterTreeMapper<TNode extends object> {
	/** A procedure leaf → its binding, or `undefined` to leave the key out (the server caller skips mutations). */
	readonly leaf: (def: ErasedProcedureDef) => TNode | undefined;
	/** A nested router → its binding; the caller recurses, since each tree kind binds subtrees its own way. */
	readonly router: (subtree: RouterTree) => TNode;
}

const INVALID_ROUTER_NODE_MESSAGE = "Invalid router node — expected a procedure leaf or nested router.";

/**
 * Walks a router tree and binds every entry through `mapper` — the one walker
 * behind the browser caller, the React client router and the SSR caller. A
 * value that is neither a procedure leaf nor a nested router throws: a
 * primitive, `null`, a function, and an array (a list is never a router — its
 * index keys would silently become route names). Narrow
 * the result to the caller's tree type with {@link assertCompleteRouterTree}.
 */
export function mapRouterTree<R extends object, TNode extends object>(router: R, mapper: RouterTreeMapper<TNode>): MappedRouterTree<R, TNode> {
	const nodes: MappedRouterTreeNodes<R, TNode> = {};
	const settledKeys = new Set<string>();

	eachRouterEntry(router, (key, value) => {
		if (!isRouterNode(value)) {
			throw new Error(INVALID_ROUTER_NODE_MESSAGE);
		}
		let node: TNode | undefined;
		if (isErasedProcedureDef(value)) {
			node = mapper.leaf(value);
		} else if (isRouterSubtree(value)) {
			node = mapper.router(value);
		} else {
			throw new Error(INVALID_ROUTER_NODE_MESSAGE);
		}
		if (node !== undefined) {
			nodes[key] = node;
		}
		settledKeys.add(key);
	});

	return { nodes, settledKeys };
}

/**
 * The one completeness guard of every mapped router tree: throws unless every
 * own key of `router` was settled by {@link mapRouterTree}, and otherwise
 * narrows the bound nodes to the caller's tree type `TTree`.
 */
export function assertCompleteRouterTree<R extends object, TTree>(
	router: R,
	nodes: MappedRouterTreeNodes<R, object> | TTree,
	settledKeys: ReadonlySet<string>,
): asserts nodes is TTree {
	eachRouterEntry(router, (key) => {
		if (!settledKeys.has(key)) {
			throw new Error("Failed to build router tree — one or more router entries were not bound.");
		}
	});
}

/** Prefixes a query key with the version when a leaf opts out of the default — v2 keys can never collide with v1 cache entries. */
function versionedKey(version: ApiVersion | undefined, base: ApiQueryKey): ApiQueryKey {
	return version === undefined ? base : [version, ...base];
}

/**
 * Declares a GET procedure from its shared contract leaf. The contract owns
 * method + path + input + response envelope; this layer adds the cache scope.
 * `scope` receives the parsed input (which must therefore carry every field
 * the scope needs); its own parameter type is what `scopeKey` accepts.
 */
export function defineQuery<Input extends SerializableInput & Scope, Data extends DataValue, Scope extends SerializableInput>(
	contract: ApiContractDef<Input, "GET", Data>,
	opts: {
		readonly scope: (scope: Scope) => ApiQueryKey;
		readonly baseOptions?: { readonly headers?: Record<string, string> | undefined } | undefined;
	},
): ScopedQueryDef<Input, Envelope<Data>, Scope> {
	const scopeKey = (scope: Scope): ApiQueryKey => versionedKey(contract.version, opts.scope(scope));
	return {
		kind: "query",
		method: "GET",
		path: contract.path,
		version: contract.version,
		access: contract.access ?? "authenticated",
		inputSchema: contract.input,
		responseSchema: contract.response.envelope,
		queryKey: (input: Input): ApiQueryKey => (input === undefined ? scopeKey(input) : [...scopeKey(input), input]),
		scopeKey,
		baseOptions: opts.baseOptions,
	};
}

/**
 * Declares a POST (or PUT/PATCH/DELETE) procedure from its shared contract
 * leaf (which also owns the response envelope). `toQuery` routes input keys
 * to the query string instead of the body.
 */
export function defineMutation<Input extends SerializableInput, Data extends DataValue, M extends Exclude<RestMethod, "GET">>(
	contract: ApiContractDef<Input, M, Data>,
	opts: {
		readonly baseOptions?: { readonly headers?: Record<string, string> | undefined } | undefined;
		readonly toBody?: ((input: Input) => DataValue) | undefined;
		readonly toQuery?: readonly string[] | undefined;
	} = {},
): MutationDef<Input, Envelope<Data>> {
	return {
		kind: "mutation",
		method: contract.method,
		path: contract.path,
		version: contract.version,
		inputSchema: contract.input,
		responseSchema: contract.response.envelope,
		baseOptions: opts.baseOptions,
		toBody: opts.toBody,
		toQuery: opts.toQuery,
	};
}

// ── REST serialization (shared by client + server) ─────────────────────────

/** Marks a path segment as a parameter: `/tenants/:tenantSlug` → `tenantSlug`. */
const PARAM_SEGMENT_PREFIX = ":";
const PATH_SEPARATOR = "/";

/**
 * The parameter name of one path segment, or `null` for a literal segment.
 * Plain string operations, never a RegExp with named groups: React Native's
 * engine (Hermes, through the bundle's regex transform) returns no `groups`
 * from `matchAll`, which once left every `:param` unsubstituted on mobile.
 */
function paramNameOf(segment: string): string | null {
	return segment.startsWith(PARAM_SEGMENT_PREFIX) && segment.length > PARAM_SEGMENT_PREFIX.length ? segment.slice(PARAM_SEGMENT_PREFIX.length) : null;
}

/** How `resolveRequest` routes leftover input keys — defaults to GET with no query overrides. */
export interface ResolveRequestOptions {
	readonly method?: RestMethod | undefined;
	readonly toQuery?: readonly string[] | undefined;
}

/** Result of serializing an input onto a path template. */
export interface ResolvedRequest {
	readonly url: string;
	/** Present for mutations (defaults to `{}` when the input has no body fields). */
	readonly body?: DataValue;
}

/**
 * The single input → REST mapping. `:param` segments consume matching input
 * keys into the path; for GET the remaining keys become the query string; for
 * mutations the remaining keys become the JSON body (except `toQuery` keys,
 * which go to the query string instead). `undefined` values are skipped.
 *
 * The `Input` constraint is what keeps this cast-free: a `SerializableInput`
 * is indexable by any key, so no `Record` re-typing is needed.
 */
export function resolveRequest(path: string, input: SerializableInput, options?: ResolveRequestOptions): ResolvedRequest {
	const record: Readonly<Record<string, DataValue | undefined>> = input ?? {};
	const method: RestMethod = options?.method ?? "GET";
	const segments: readonly string[] = path.split(PATH_SEPARATOR);
	const paramNames: readonly string[] = segments.flatMap((segment) => {
		const name = paramNameOf(segment);
		return name === null ? [] : [name];
	});

	const consumed = new Set<string>(paramNames);
	for (const key of options?.toQuery ?? []) consumed.add(key);

	let url = segments
		.map((segment) => {
			const name = paramNameOf(segment);
			return name === null ? segment : encodeURIComponent(stringifyQueryValue(record[name]));
		})
		.join(PATH_SEPARATOR);

	// Leftover keys → query string (GET) or body (mutations); `undefined` values are dropped.
	const leftover: readonly { readonly key: string; readonly value: DataValue }[] = Object.keys(record).flatMap((key) => {
		const value: DataValue | undefined = record[key];
		if (consumed.has(key) || value === undefined) return [];
		return [{ key, value }];
	});

	if (method === "GET") {
		if (leftover.length > 0) {
			url = `${url}${url.includes("?") ? "&" : "?"}${toQueryString(leftover)}`;
		}
		return { url };
	}

	// Mutations: `toQuery` keys ride the query string, everything else is the body.
	const toQueryEntries: readonly { readonly key: string; readonly value: DataValue }[] = (options?.toQuery ?? []).flatMap((key) => {
		const value: DataValue | undefined = record[key];
		if (value === undefined) return [];
		return [{ key, value }];
	});
	if (toQueryEntries.length > 0) {
		url = `${url}${url.includes("?") ? "&" : "?"}${toQueryString(toQueryEntries)}`;
	}

	const body: Record<string, DataValue> = {};
	for (const { key, value } of leftover) body[key] = value;
	return { url, body };
}

/**
 * Query-string serialization shared by GET inputs and mutation `toQuery` keys:
 * nested objects become bracket keys (`filter[status][in]=A,B`) and arrays
 * become comma lists — the list-query grammar the API decodes
 * (`flattenQueryParams` is the inverse of the API's `nestBracketQueryParams`).
 */
function toQueryString(entries: readonly { readonly key: string; readonly value: DataValue }[]): string {
	const search = new URLSearchParams();
	for (const { key, value } of entries) {
		for (const [name, serialized] of flattenQueryParams(key, value)) search.append(name, serialized);
	}
	return search.toString();
}

/** Serializes a path-param value without tripping no-base-to-string on arbitrary values. */
function stringifyQueryValue(value: DataValue | undefined): string {
	if (value === undefined) return "";
	if (isStringPrimitive(value)) return value;
	if (isNumberPrimitive(value) || isBooleanPrimitive(value)) return String(value);
	if (value === null) return "null";
	// Non-primitive values are normalized to their JSON form (schemas only
	// allow primitives on query strings, so this is defensive only).
	return JSON.stringify(value);
}

// ── The router ─────────────────────────────────────────────────────────────
// Every leaf derives path/method/input/response from `apiContract` (shared)
// and only adds the client-side cache scope (queries). Adding a route = adding one
// contract leaf in `@workspace/shared` + one def here + one pipe in the API
// controller — a missing leaf is a compile error on the client and a 400 on
// the API side.

export const apiRouter = {
	auth: {
		/** "Who am I?" — profile without permissions. */
		me: defineQuery(apiContract.auth.me, { scope: (): ApiQueryKey => ["auth", "me"] }),
		/** The signed-in user's own editable profile (name, avatar, optimistic-lock `version`). */
		profile: defineQuery(apiContract.auth.profile, { scope: (): ApiQueryKey => ["auth", "profile"] }),
		/** Edits the own profile — refresh `profile` and `me` after it (see `useUpdateOwnProfile`). */
		updateProfile: defineMutation(apiContract.auth.updateProfile),
		/** Session roles + permissions — refetch after RBAC mutations. */
		permissions: defineQuery(apiContract.auth.permissions, { scope: (): ApiQueryKey => ["auth", "permissions"] }),
		/** Very basic protected endpoint — proves the access token is valid and answers "who am I + when does my token expire" with no DB work. */
		sessionStatus: defineQuery(apiContract.auth.sessionStatus, { scope: (): ApiQueryKey => ["auth", "session-status"] }),
		login: defineMutation(apiContract.auth.login),
		/** Admin login — sends `X-Client-Type: admin` for cookie isolation. */
		adminLogin: defineMutation(apiContract.auth.adminLogin, { baseOptions: { headers: clientTypeHeader("admin") } }),
		/** Merchant login — sends `X-Client-Type: merchant` for cookie isolation. */
		merchantLogin: defineMutation(apiContract.auth.login, { baseOptions: { headers: clientTypeHeader("merchant") } }),
		signup: defineMutation(apiContract.auth.signup),
		signupReferralsDashboard: defineQuery(apiContract.auth.signupReferralsDashboard, { scope: (): ApiQueryKey => ["auth", "signup-referrals", "dashboard"] }),
		signupReferralsReferees: defineQuery(apiContract.auth.signupReferralsReferees, { scope: (): ApiQueryKey => ["auth", "signup-referrals", "referees"] }),
		refresh: defineMutation(apiContract.auth.refresh),
		logout: defineMutation(apiContract.auth.logout),
		/** Signs out every device session of the user (the browser's refresh cookie identifies the user). */
		logoutAll: defineMutation(apiContract.auth.logoutAll),
		/** The caller's signed-in devices — invalidate this scope after revoking one. */
		sessions: defineQuery(apiContract.auth.sessions, { scope: (): ApiQueryKey => ["auth", "sessions"] }),
		/** Signs out one of the caller's devices (ADR 034). */
		revokeSession: defineMutation(apiContract.auth.revokeSession),
		forgotPassword: defineMutation(apiContract.auth.forgotPassword),
		resetPassword: defineMutation(apiContract.auth.resetPassword),
		validateResetToken: defineMutation(apiContract.auth.validateResetToken),
		resendVerification: defineMutation(apiContract.auth.resendVerification),
		verifyEmail: defineMutation(apiContract.auth.verifyEmail),
		changePassword: defineMutation(apiContract.auth.changePassword),
		loginTwoFactor: defineMutation(apiContract.auth.loginTwoFactor),
		loginBackupCode: defineMutation(apiContract.auth.loginBackupCode),
		verifyLogin: defineMutation(apiContract.auth.verifyLogin),
		/** Starts (or restarts) a 2FA enrollment: stores a pending secret server-side, so it is a mutation. */
		twoFactorSetup: defineMutation(apiContract.auth.twoFactorSetup),
		twoFactorEnable: defineMutation(apiContract.auth.twoFactorEnable),
		twoFactorRotate: defineMutation(apiContract.auth.twoFactorRotate),
		twoFactorBackupCodesRemaining: defineQuery(apiContract.auth.twoFactorBackupCodesRemaining, { scope: (): ApiQueryKey => ["auth", "2fa-backup-codes-remaining"] }),
		twoFactorVerifyBackupCode: defineMutation(apiContract.auth.twoFactorVerifyBackupCode),
		mfaRecoveryInitiate: defineMutation(apiContract.auth.mfaRecoveryInitiate),
		mfaRecoveryStatus: defineQuery(apiContract.auth.mfaRecoveryStatus, { scope: (): ApiQueryKey => ["auth", "mfa-recovery-status"] }),
		adminMfaRecoveryReview: defineMutation(apiContract.auth.adminMfaRecoveryReview),
		adminMfaRecoveryRequests: defineQuery(apiContract.auth.adminMfaRecoveryRequests, { scope: (): ApiQueryKey => ["auth", "admin-mfa-recovery-requests"] }),
		adminUsers: defineQuery(apiContract.auth.adminUsers, { scope: (): ApiQueryKey => ["auth", "admin-users"] }),
		adminUserDetail: defineQuery(apiContract.auth.adminUserDetail, { scope: ({ userId }: { readonly userId: string }): ApiQueryKey => ["auth", "admin-user", userId] }),
		adminUserBan: defineMutation(apiContract.auth.adminUserBan),
		adminUserUnban: defineMutation(apiContract.auth.adminUserUnban),
		impersonate: defineMutation(apiContract.auth.impersonate),
		stopImpersonation: defineMutation(apiContract.auth.stopImpersonation),
	},

	// Every GitHub key starts with `repositories`' scope, so invalidating that one scope reloads the list and every repository view.
	github: {
		/** The repositories the API may read (pinned or discovered) — empty when the integration is off. */
		repositories: defineQuery(apiContract.github.repositories, { scope: (): ApiQueryKey => ["github", "repositories"] }),
		repositorySummary: defineQuery(apiContract.github.repositorySummary, {
			scope: ({ owner, repository }: GithubRepositoryScope): ApiQueryKey => ["github", "repositories", owner, repository, "summary"],
		}),
		/** One page per cursor — the cursor is part of the input, so each page is its own cache entry. */
		repositoryCommits: defineQuery(apiContract.github.repositoryCommits, {
			scope: ({ owner, repository }: GithubRepositoryScope): ApiQueryKey => ["github", "repositories", owner, repository, "commits"],
		}),
		/** A commit never changes, so its key is its sha — nested under the repository like every other view. */
		repositoryCommit: defineQuery(apiContract.github.repositoryCommit, {
			scope: ({ owner, repository }: GithubRepositoryScope): ApiQueryKey => ["github", "repositories", owner, repository, "commit"],
		}),
		repositoryContributors: defineQuery(apiContract.github.repositoryContributors, {
			scope: ({ owner, repository }: GithubRepositoryScope): ApiQueryKey => ["github", "repositories", owner, repository, "contributors"],
		}),
	},

	// Every pull-request key starts with ["github-pull-requests"]: unlinking (or linking another account) invalidates that one scope.
	githubPullRequests: {
		/** The caller's GitHub link (or `off`). */
		account: defineQuery(apiContract.githubPullRequests.account, { scope: (): ApiQueryKey => [GITHUB_PULL_REQUESTS_QUERY_ROOT, "account"] }),
		/** Link or replace the token — then invalidate the whole `["github-pull-requests"]` scope. */
		linkAccount: defineMutation(apiContract.githubPullRequests.linkAccount),
		unlinkAccount: defineMutation(apiContract.githubPullRequests.unlinkAccount),
		/** One page per filter, state and cursor (each its own cache entry). */
		list: defineQuery(apiContract.githubPullRequests.list, { scope: (): ApiQueryKey => [GITHUB_PULL_REQUESTS_QUERY_ROOT, "list"] }),
		detail: defineQuery(apiContract.githubPullRequests.detail, {
			scope: (scope: GithubPullRequestScope): ApiQueryKey => [...githubPullRequestScopeKey(scope), "detail"],
		}),
		timeline: defineQuery(apiContract.githubPullRequests.timeline, {
			scope: (scope: GithubPullRequestScope): ApiQueryKey => [...githubPullRequestScopeKey(scope), "timeline"],
		}),
		commits: defineQuery(apiContract.githubPullRequests.commits, {
			scope: (scope: GithubPullRequestScope): ApiQueryKey => [...githubPullRequestScopeKey(scope), "commits"],
		}),
		/** The merge box (checks, conflicts) — under the pull request's scope, so a refresh or a write reloads it too. */
		status: defineQuery(apiContract.githubPullRequests.status, {
			scope: (scope: GithubPullRequestScope): ApiQueryKey => [...githubPullRequestScopeKey(scope), "status"],
		}),
		/** One commit of the pull request with its diff — under the pull request's scope, so a refresh of it reloads this too. */
		commit: defineQuery(apiContract.githubPullRequests.commit, {
			scope: (scope: GithubPullRequestScope): ApiQueryKey => [...githubPullRequestScopeKey(scope), "commit"],
		}),
		files: defineQuery(apiContract.githubPullRequests.files, {
			scope: (scope: GithubPullRequestScope): ApiQueryKey => [...githubPullRequestScopeKey(scope), "files"],
		}),
		reviewThreads: defineQuery(apiContract.githubPullRequests.reviewThreads, {
			scope: (scope: GithubPullRequestScope): ApiQueryKey => [...githubPullRequestScopeKey(scope), "review-threads"],
		}),
		/** Writes go to GitHub as the linked account; send them with `useIdempotentMutation` so a retry never posts twice. Then refresh the pull request's scope. */
		addComment: defineMutation(apiContract.githubPullRequests.addComment),
		submitReview: defineMutation(apiContract.githubPullRequests.submitReview),
		setReaction: defineMutation(apiContract.githubPullRequests.setReaction),
		attachPicture: defineMutation(apiContract.githubPullRequests.attachPicture),
		merge: defineMutation(apiContract.githubPullRequests.merge),
		liveUpdates: defineQuery(apiContract.githubPullRequests.liveUpdates, {
			scope: ({ owner, repository }: { readonly owner: string; readonly repository: string }): ApiQueryKey => githubLiveUpdatesKey(owner, repository),
		}),
		enableLiveUpdates: defineMutation(apiContract.githubPullRequests.enableLiveUpdates),
		disableLiveUpdates: defineMutation(apiContract.githubPullRequests.disableLiveUpdates),
		/** A comment's saved versions — keyed by its node id. */
		contentEdits: defineQuery(apiContract.githubPullRequests.contentEdits, {
			scope: ({ nodeId }: { readonly nodeId: string }): ApiQueryKey => [GITHUB_PULL_REQUESTS_QUERY_ROOT, "edits", nodeId],
		}),
	},

	capabilities: {
		catalog: defineQuery(apiContract.capabilities.catalog, { scope: (): ApiQueryKey => ["capabilities", "catalog"] }),
	},

	admin: {
		roles: {
			list: defineQuery(apiContract.admin.roles.list, { scope: (): ApiQueryKey => ["admin", "roles", "list"] }),
			userAssign: defineMutation(apiContract.admin.roles.userAssign),
			userRemove: defineMutation(apiContract.admin.roles.userRemove),
			userSync: defineMutation(apiContract.admin.roles.userSync),
		},
		permissions: {
			list: defineQuery(apiContract.admin.permissions.list, { scope: (): ApiQueryKey => ["admin", "permissions", "list"] }),
			check: defineMutation(apiContract.admin.permissions.check),
			userGrant: defineMutation(apiContract.admin.permissions.userGrant),
			userRevoke: defineMutation(apiContract.admin.permissions.userRevoke),
			userSync: defineMutation(apiContract.admin.permissions.userSync),
		},
	},

	// ── Global HTTP audit trail (admin viewer) ────────────────────────────────
	auditLogs: {
		list: defineQuery(apiContract.auditLogs.list, { scope: (): ApiQueryKey => ["audit-logs", "list"] }),
		detail: defineQuery(apiContract.auditLogs.detail, { scope: ({ id }: { readonly id: string }): ApiQueryKey => ["audit-logs", "detail", id] }),
	},

	// ── The audit log's timeline (requests + background writes) ──────────────
	auditTrail: {
		list: defineQuery(apiContract.auditTrail.list, { scope: (): ApiQueryKey => ["audit-trail", "list"] }),
	},

	// ── Row-level data-change trail (admin viewer) ────────────────────────────
	dataChanges: {
		list: defineQuery(apiContract.dataChanges.list, { scope: (): ApiQueryKey => ["data-changes", "list"] }),
		detail: defineQuery(apiContract.dataChanges.detail, { scope: ({ id }: { readonly id: string }): ApiQueryKey => ["data-changes", "detail", id] }),
	},

	// ── Email template preview procedures ─────────────────────────────────────
	email: {
		previewList: defineQuery(apiContract.email.previewList, { scope: (): ApiQueryKey => ["email", "preview-list"] }),
		/** Preview detail for one template key. */
		previewDetail: defineQuery(apiContract.email.previewDetail, { scope: (): ApiQueryKey => ["email", "preview-detail"] }),
		/** Sends one template to the configured test address. */
		previewSend: defineMutation(apiContract.email.previewSend),
		/** Every email-log list page — `scopeKey(undefined)` refetches them all (the SSE live view does). */
		logList: defineQuery(apiContract.email.logList, { scope: (): ApiQueryKey => ["email", "log-list"] }),
	},

	geo: {
		stats: defineQuery(apiContract.geo.stats, { scope: (): ApiQueryKey => ["geo", "stats"] }),
		countries: defineQuery(apiContract.geo.countries, { scope: (): ApiQueryKey => ["geo", "countries"] }),
		states: defineQuery(apiContract.geo.states, { scope: (): ApiQueryKey => ["geo", "states"] }),
		cities: defineQuery(apiContract.geo.cities, { scope: (): ApiQueryKey => ["geo", "cities"] }),
	},

	rewards: {
		list: defineQuery(apiContract.rewards.list, { scope: (): ApiQueryKey => ["rewards", "list"] }),
		detail: defineQuery(apiContract.rewards.detail, { scope: ({ rewardId }: { readonly rewardId: string }): ApiQueryKey => ["rewards", "detail", rewardId] }),
	},
	legal: {
		accept: defineMutation(apiContract.legal.accept),
		status: defineQuery(apiContract.legal.status, { scope: (): ApiQueryKey => ["legal", "status"] }),
	},
	claims: {
		otp: defineMutation(apiContract.claims.otp),
		create: defineMutation(apiContract.claims.create),
		list: defineQuery(apiContract.claims.list, { scope: (): ApiQueryKey => ["claims", "list"] }),
		analytics: defineQuery(apiContract.claims.analytics, { scope: (): ApiQueryKey => ["claims", "analytics"] }),
		/** The customer's analytics dashboard (custom range + interval); keyed under the `analytics` scope. */
		analyticsDashboard: defineQuery(apiContract.claims.analyticsDashboard, { scope: (): ApiQueryKey => ["claims", "analytics", "dashboard"] }),
		/** One of the caller's own claims — the wallet QR page's server-prefetched read model (never carries codes). */
		get: defineQuery(apiContract.claims.get, { scope: ({ claimId }: { readonly claimId: string }): ApiQueryKey => ["claims", "detail", claimId] }),
		/** Issues fresh QR + backup codes for a PENDING claim. A command (it rotates the stored code hashes), so it is never prefetched or cached. */
		qr: defineMutation(apiContract.claims.qr),
	},
	rewardNotifications: {
		list: defineQuery(apiContract.rewardNotifications.list, { scope: (): ApiQueryKey => ["reward-notifications", "list"] }),
		read: defineMutation(apiContract.rewardNotifications.read),
	},
	files: {
		uploadUrl: defineMutation(apiContract.files.uploadUrl),
		tenantUploadUrl: defineMutation(apiContract.files.tenantUploadUrl),
		complete: defineMutation(apiContract.files.complete),
		detail: defineQuery(apiContract.files.detail, { scope: ({ fileId }: { readonly fileId: string }): ApiQueryKey => ["files", "detail", fileId] }),
		downloadUrl: defineQuery(apiContract.files.downloadUrl, { scope: ({ fileId }: { readonly fileId: string }): ApiQueryKey => ["files", "download-url", fileId] }),
		delete: defineMutation(apiContract.files.delete),
	},
	referrals: {
		createLink: defineMutation(apiContract.referrals.createLink),
		recordAttribution: defineMutation(apiContract.referrals.recordAttribution),
	},
	supportAccess: {
		/** Platform admins: every grant, newest first. Invalidate after request / revoke. */
		list: defineQuery(apiContract.supportAccess.list, { scope: (): ApiQueryKey => ["support-access", "grants"] }),
		/** The tenant owner's grants (to approve). */
		tenantList: defineQuery(apiContract.supportAccess.tenantList, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "support-access"] }),
		request: defineMutation(apiContract.supportAccess.request),
		approve: defineMutation(apiContract.supportAccess.approve),
		revoke: defineMutation(apiContract.supportAccess.revoke),
	},
	tenants: {
		/** The member's tenants (membership + capabilities) — invalidate after any identity or membership change. */
		membershipsBootstrap: defineQuery(apiContract.tenants.membershipsBootstrap, { scope: (): ApiQueryKey => ["tenants", "memberships"] }),
		context: defineQuery(apiContract.tenants.context, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "context"] }),
		listMembers: defineQuery(apiContract.tenants.listMembers, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "members", "list"] }),
		listMemberInvites: defineQuery(apiContract.tenants.listMemberInvites, {
			scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "members", "invites"],
		}),
		inviteMember: defineMutation(apiContract.tenants.inviteMember),
		/** The tenant's active customer bans. Invalidate it and `redemptions` (the log's "banned" badge) after a ban or a lift. */
		customerBans: defineQuery(apiContract.tenants.customerBans, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "customer-bans"] }),
		banCustomer: defineMutation(apiContract.tenants.banCustomer),
		liftCustomerBan: defineMutation(apiContract.tenants.liftCustomerBan),
		revokeMemberInvite: defineMutation(apiContract.tenants.revokeMemberInvite),
		removeMemberFromLocation: defineMutation(apiContract.tenants.removeMemberFromLocation),
		/** The signed-in member's own membership (display name). Invalidate `context` and `listMembers` of the tenant after it. */
		updateOwnMembership: defineMutation(apiContract.tenants.updateOwnMembership),
		/** Leave the tenant (any membership status). Invalidate `membershipsBootstrap` after it. */
		leaveTenant: defineMutation(apiContract.tenants.leaveTenant),
		/** The tenant's lifecycle state, suspension and appeals — readable while suspended or pending deletion. */
		lifecycle: defineQuery(apiContract.tenants.lifecycle, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "lifecycle"] }),
		submitAppeal: defineMutation(apiContract.tenants.submitAppeal),
		reactivate: defineMutation(apiContract.tenants.reactivate),
		validateTeamInvite: defineMutation(apiContract.tenants.validateTeamInvite),
		acceptTeamInvite: defineMutation(apiContract.tenants.acceptTeamInvite),
		registerAndAcceptTeamInvite: defineMutation(apiContract.tenants.registerAndAcceptTeamInvite, { baseOptions: { headers: clientTypeHeader("merchant") } }),
		kyb: {
			get: defineQuery(apiContract.tenants.kyb.get, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "kyb"] }),
			submit: defineMutation(apiContract.tenants.kyb.submit),
			downloadDocument: defineQuery(apiContract.tenants.kyb.downloadDocument, {
				scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "kyb", "documents", "download"],
			}),
		},
		rewards: {
			list: defineQuery(apiContract.tenants.rewards.list, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "rewards", "list"] }),
			get: defineQuery(apiContract.tenants.rewards.get, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "rewards", "detail"] }),
			summary: defineQuery(apiContract.tenants.rewards.summary, {
				scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "rewards", "summary"],
			}),
			create: defineMutation(apiContract.tenants.rewards.create),
			update: defineMutation(apiContract.tenants.rewards.update),
			publish: defineMutation(apiContract.tenants.rewards.publish),
		},
		apiKeys: {
			list: defineQuery(apiContract.tenants.apiKeys.list, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "api-keys", "list"] }),
			create: defineMutation(apiContract.tenants.apiKeys.create),
			revoke: defineMutation(apiContract.tenants.apiKeys.revoke),
		},
		terminals: {
			list: defineQuery(apiContract.tenants.terminals.list, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "terminals", "list"] }),
			summary: defineQuery(apiContract.tenants.terminals.summary, {
				scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "terminals", "summary"],
			}),
			get: defineQuery(apiContract.tenants.terminals.get, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "terminals", "detail"] }),
			create: defineMutation(apiContract.tenants.terminals.create),
			pairingCode: defineMutation(apiContract.tenants.terminals.pairingCode),
			remove: defineMutation(apiContract.tenants.terminals.remove),
			settings: defineQuery(apiContract.tenants.terminals.settings, {
				scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "terminals", "settings"],
			}),
			updateSettings: defineMutation(apiContract.tenants.terminals.updateSettings),
		},
		redemptions: defineQuery(apiContract.tenants.redemptions, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "redemptions"] }),
		analytics: defineQuery(apiContract.tenants.analytics, { scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "analytics"] }),
		/** The merchant analytics dashboard (custom range + interval, breakdowns); the export is `apiDownloads.tenants.analyticsExport`. */
		analyticsDashboard: defineQuery(apiContract.tenants.analyticsDashboard, {
			scope: ({ tenantSlug }: TenantScope): ApiQueryKey => ["tenant", tenantSlug, "analytics", "dashboard"],
		}),
		locations: {
			create: defineMutation(apiContract.tenants.locations.create),
			update: defineMutation(apiContract.tenants.locations.update),
			close: defineMutation(apiContract.tenants.locations.close),
		},
		onboarding: {
			validate: defineMutation(apiContract.tenants.onboarding.validate),
			complete: defineMutation(apiContract.tenants.onboarding.complete),
			documentUploadUrl: defineMutation(apiContract.tenants.onboarding.documentUploadUrl),
			documentBatchUploadUrl: defineMutation(apiContract.tenants.onboarding.documentBatchUploadUrl),
			documentUploadComplete: defineMutation(apiContract.tenants.onboarding.documentUploadComplete),
			documentBatchUploadComplete: defineMutation(apiContract.tenants.onboarding.documentBatchUploadComplete),
			documentsSubmit: defineMutation(apiContract.tenants.onboarding.documentsSubmit),
			// POST (the invite token stays out of URLs): poll it from a query whose queryFn calls `.mutate`.
			documentStatus: defineMutation(apiContract.tenants.onboarding.documentStatus),
		},
	},

	rewardsAdmin: {
		pendingRewards: defineQuery(apiContract.rewardsAdmin.pendingRewards, { scope: (): ApiQueryKey => ["rewards-admin", "pending"] }),
		/** One reward in full (the moderation detail page); its key prefixes the reward's image downloads. */
		getReward: defineQuery(apiContract.rewardsAdmin.getReward, {
			scope: ({ rewardId }: { readonly rewardId: string }): ApiQueryKey => ["rewards-admin", "rewards", rewardId],
		}),
		listTenants: defineQuery(apiContract.rewardsAdmin.listTenants, { scope: (): ApiQueryKey => ["rewards-admin", "tenants"] }),
		getTenant: defineQuery(apiContract.rewardsAdmin.getTenant, {
			scope: ({ tenantId }: AdminTenantScope): ApiQueryKey => ["rewards-admin", "tenant", tenantId],
		}),
		downloadTenantDocument: defineQuery(apiContract.rewardsAdmin.downloadTenantDocument, {
			scope: ({ tenantId }: AdminTenantScope): ApiQueryKey => ["rewards-admin", "tenant", tenantId, "documents", "download"],
		}),
		getTenantLifecycle: defineQuery(apiContract.rewardsAdmin.getTenantLifecycle, {
			scope: ({ tenantId }: AdminTenantScope): ApiQueryKey => ["rewards-admin", "tenant", tenantId, "lifecycle"],
		}),
		suspendTenant: defineMutation(apiContract.rewardsAdmin.suspendTenant),
		reinstateTenant: defineMutation(apiContract.rewardsAdmin.reinstateTenant),
		banTenant: defineMutation(apiContract.rewardsAdmin.banTenant),
		unbanTenant: defineMutation(apiContract.rewardsAdmin.unbanTenant),
		rejectTenantAppeal: defineMutation(apiContract.rewardsAdmin.rejectTenantAppeal),
		createInvite: defineMutation(apiContract.rewardsAdmin.createInvite),
		/** Whether this deployment may invite a new merchant (false in single-tenant mode). */
		inviteAvailability: defineQuery(apiContract.rewardsAdmin.inviteAvailability, { scope: (): ApiQueryKey => ["rewards-admin", "invites", "availability"] }),
		previewInviteEmail: defineQuery(apiContract.rewardsAdmin.previewInviteEmail, { scope: (): ApiQueryKey => ["rewards-admin", "invites", "preview-email"] }),
		salesAnalytics: defineQuery(apiContract.rewardsAdmin.salesAnalytics, { scope: (): ApiQueryKey => ["rewards-admin", "analytics", "sales"] }),
		/** The platform analytics dashboard; the export is `apiDownloads.rewardsAdmin.analyticsExport`. */
		analyticsDashboard: defineQuery(apiContract.rewardsAdmin.analyticsDashboard, { scope: (): ApiQueryKey => ["rewards-admin", "analytics", "dashboard"] }),
		/** A signed URL that downloads one image of a reward — fetched on demand (`fetchOrThrow`), it expires. */
		downloadRewardImage: defineQuery(apiContract.rewardsAdmin.downloadRewardImage, {
			scope: ({ rewardId }: { readonly rewardId: string }): ApiQueryKey => ["rewards-admin", "rewards", rewardId, "images", "download"],
		}),
		approveReward: defineMutation(apiContract.rewardsAdmin.approveReward),
		rejectReward: defineMutation(apiContract.rewardsAdmin.rejectReward),
		updateKyb: defineMutation(apiContract.rewardsAdmin.updateKyb),
		listLocationRequests: defineQuery(apiContract.rewardsAdmin.listLocationRequests, { scope: (): ApiQueryKey => ["rewards-admin", "location-requests"] }),
		createLocation: defineMutation(apiContract.rewardsAdmin.createLocation),
		reviewLocation: defineMutation(apiContract.rewardsAdmin.reviewLocation),
	},
	sampleCategory: {
		list: defineQuery(apiContract.sampleCategory.list, { scope: (): ApiQueryKey => ["sample-category", "list"] }),
		detail: defineQuery(apiContract.sampleCategory.detail, { scope: ({ id }: { readonly id: string }): ApiQueryKey => ["sample-category", "detail", id] }),
		create: defineMutation(apiContract.sampleCategory.create),
		bulkCreate: defineMutation(apiContract.sampleCategory.bulkCreate),
		bulkDelete: defineMutation(apiContract.sampleCategory.bulkDelete),
		update: defineMutation(apiContract.sampleCategory.update),
		delete: defineMutation(apiContract.sampleCategory.delete),
		restore: defineMutation(apiContract.sampleCategory.restore),
	},
	product: {
		list: defineQuery(apiContract.product.list, { scope: (): ApiQueryKey => ["product", "list"] }),
		detail: defineQuery(apiContract.product.detail, { scope: ({ id }: { readonly id: string }): ApiQueryKey => ["product", "detail", id] }),
		create: defineMutation(apiContract.product.create),
		bulkCreate: defineMutation(apiContract.product.bulkCreate),
		bulkDelete: defineMutation(apiContract.product.bulkDelete),
		update: defineMutation(apiContract.product.update),
		delete: defineMutation(apiContract.product.delete),
		restore: defineMutation(apiContract.product.restore),
	},
};

/** The full router tree — used to derive the client router + server caller types. */
export type ApiRouter = typeof apiRouter;
