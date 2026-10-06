// ============================================
// lib/endpoints.ts - Typed API router (tRPC-flavoured, REST under the hood)
// ============================================
// Pure module (zod schemas + plain procedure definitions — no hooks, no
// browser APIs), deliberately NOT marked "use client": the same router is used
// by client pages for data fetching (useApi builds a client router from it)
// AND by server components for SSR prefetching (server-api.ts builds a caller
// from it), so the definitions must be callable on both sides.
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

import type { QueryKey } from "@tanstack/react-query";
import {
	apiContract,
	clientTypeHeader,
	flattenQueryParams,
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
// Every query key is `[...scope, input]`: a SCOPE (the resource the data
// belongs to, e.g. `["organization", orgSlug, "kyb"]`) followed by the WHOLE
// parsed input. Two consequences, both by construction:
// - no input field can be left out of a key (no silently shared cache entries
//   between, say, two stores or two date ranges);
// - `def.scopeKey(scope)` is a prefix of every key the def produces for that
//   scope, so invalidating with it always reaches the cached queries.
// Code outside this module never writes a key by hand: it invalidates with
// `apiRouter.<…>.scopeKey(…)` (or `queryKey(input)` for one exact entry). The
// lint config rejects array literals as cache keys (docs/technical/tooling/eslint.md).

/**
 * A scope's fields. The index signature keeps every scope assignable to
 * `SerializableInput` (a scope is a slice of a query's input).
 */
type ScopeFields = Readonly<Record<string, DataValue | undefined>>;

/** Scope of every organization-owned resource. */
export interface OrganizationScope extends ScopeFields {
	readonly orgSlug: string;
}

/** Scope of one admin-managed organization. */
export interface AdminOrganizationScope extends ScopeFields {
	readonly organizationId: string;
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
	readonly queryKey: (input: Input) => QueryKey;
	/**
	 * The cache scope of an input: a prefix of `queryKey(input)` and of every
	 * other key in the same scope — invalidate / read the cache with it.
	 * `ScopedQueryDef` narrows the parameter to just the scope's fields.
	 */
	readonly scopeKey: (scope: Input) => QueryKey;
	readonly baseOptions?: { readonly headers?: Record<string, string> | undefined } | undefined;
}

/** A query def plus its invalidation prefix. */
export interface ScopedQueryDef<Input extends SerializableInput & Scope, Resp extends DataValue, Scope extends SerializableInput> extends QueryDef<Input, Resp> {
	/** Prefix of every key this def produces for `scope` — invalidate / read the cache with it. */
	readonly scopeKey: (scope: Scope) => QueryKey;
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
 * value that is neither a procedure leaf nor a nested router throws. Narrow
 * the result to the caller's tree type with {@link assertCompleteRouterTree}.
 */
export function mapRouterTree<R extends object, TNode extends object>(router: R, mapper: RouterTreeMapper<TNode>): MappedRouterTree<R, TNode> {
	const nodes: MappedRouterTreeNodes<R, TNode> = {};
	const settledKeys = new Set<string>();

	eachRouterEntry(router, (key, value) => {
		if (typeof value !== "object" || value === null) {
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
function versionedKey(version: ApiVersion | undefined, base: QueryKey): QueryKey {
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
		readonly scope: (scope: Scope) => QueryKey;
		readonly baseOptions?: { readonly headers?: Record<string, string> | undefined } | undefined;
	},
): ScopedQueryDef<Input, Envelope<Data>, Scope> {
	const scopeKey = (scope: Scope): QueryKey => versionedKey(contract.version, opts.scope(scope));
	return {
		kind: "query",
		method: "GET",
		path: contract.path,
		version: contract.version,
		access: contract.access ?? "authenticated",
		inputSchema: contract.input,
		responseSchema: contract.response.envelope,
		queryKey: (input: Input): QueryKey => (input === undefined ? scopeKey(input) : [...scopeKey(input), input]),
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

const PARAM_PATTERN = /:([A-Za-z0-9_]+)/g;

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
	const paramNames: readonly string[] = [...path.matchAll(PARAM_PATTERN)].map((match) => match[1] ?? "");

	const consumed = new Set<string>(paramNames);
	for (const key of options?.toQuery ?? []) consumed.add(key);

	let url = path;
	for (const param of paramNames) {
		url = url.replace(`:${param}`, encodeURIComponent(stringifyQueryValue(record[param])));
	}

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
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
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
		me: defineQuery(apiContract.auth.me, { scope: (): QueryKey => ["auth", "me"] }),
		/** The signed-in user's own editable profile (name, avatar, optimistic-lock `version`). */
		profile: defineQuery(apiContract.auth.profile, { scope: (): QueryKey => ["auth", "profile"] }),
		/** Edits the own profile — refresh `profile` and `me` after it (see `useUpdateOwnProfile`). */
		updateProfile: defineMutation(apiContract.auth.updateProfile),
		/** Session roles + permissions — refetch after RBAC mutations. */
		permissions: defineQuery(apiContract.auth.permissions, { scope: (): QueryKey => ["auth", "permissions"] }),
		/** Very basic protected endpoint — proves the access token is valid and answers "who am I + when does my token expire" with no DB work. */
		sessionStatus: defineQuery(apiContract.auth.sessionStatus, { scope: (): QueryKey => ["auth", "session-status"] }),
		login: defineMutation(apiContract.auth.login),
		/** Admin login — sends `X-Client-Type: admin` for cookie isolation. */
		adminLogin: defineMutation(apiContract.auth.adminLogin, { baseOptions: { headers: clientTypeHeader("admin") } }),
		/** Merchant login — sends `X-Client-Type: merchant` for cookie isolation. */
		merchantLogin: defineMutation(apiContract.auth.login, { baseOptions: { headers: clientTypeHeader("merchant") } }),
		signup: defineMutation(apiContract.auth.signup),
		refresh: defineMutation(apiContract.auth.refresh),
		logout: defineMutation(apiContract.auth.logout),
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
		twoFactorBackupCodesRemaining: defineQuery(apiContract.auth.twoFactorBackupCodesRemaining, { scope: (): QueryKey => ["auth", "2fa-backup-codes-remaining"] }),
		twoFactorVerifyBackupCode: defineMutation(apiContract.auth.twoFactorVerifyBackupCode),
		mfaRecoveryInitiate: defineMutation(apiContract.auth.mfaRecoveryInitiate),
		mfaRecoveryStatus: defineQuery(apiContract.auth.mfaRecoveryStatus, { scope: (): QueryKey => ["auth", "mfa-recovery-status"] }),
		adminMfaRecoveryReview: defineMutation(apiContract.auth.adminMfaRecoveryReview),
		adminMfaRecoveryRequests: defineQuery(apiContract.auth.adminMfaRecoveryRequests, { scope: (): QueryKey => ["auth", "admin-mfa-recovery-requests"] }),
		adminUsers: defineQuery(apiContract.auth.adminUsers, { scope: (): QueryKey => ["auth", "admin-users"] }),
		adminUserDetail: defineQuery(apiContract.auth.adminUserDetail, { scope: ({ userId }: { readonly userId: string }): QueryKey => ["auth", "admin-user", userId] }),
		impersonate: defineMutation(apiContract.auth.impersonate),
		stopImpersonation: defineMutation(apiContract.auth.stopImpersonation),
	},

	capabilities: {
		catalog: defineQuery(apiContract.capabilities.catalog, { scope: (): QueryKey => ["capabilities", "catalog"] }),
	},

	admin: {
		roles: {
			list: defineQuery(apiContract.admin.roles.list, { scope: (): QueryKey => ["admin", "roles", "list"] }),
			userAssign: defineMutation(apiContract.admin.roles.userAssign),
			userRemove: defineMutation(apiContract.admin.roles.userRemove),
			userSync: defineMutation(apiContract.admin.roles.userSync),
		},
		permissions: {
			list: defineQuery(apiContract.admin.permissions.list, { scope: (): QueryKey => ["admin", "permissions", "list"] }),
			check: defineMutation(apiContract.admin.permissions.check),
			userGrant: defineMutation(apiContract.admin.permissions.userGrant),
			userRevoke: defineMutation(apiContract.admin.permissions.userRevoke),
			userSync: defineMutation(apiContract.admin.permissions.userSync),
		},
	},

	// ── Global HTTP audit trail (admin viewer) ────────────────────────────────
	auditLogs: {
		list: defineQuery(apiContract.auditLogs.list, { scope: (): QueryKey => ["audit-logs", "list"] }),
		detail: defineQuery(apiContract.auditLogs.detail, { scope: ({ id }: { readonly id: string }): QueryKey => ["audit-logs", "detail", id] }),
	},

	// ── Email template preview procedures ─────────────────────────────────────
	email: {
		previewList: defineQuery(apiContract.email.previewList, { scope: (): QueryKey => ["email", "preview-list"] }),
		/** Preview detail for one template key. */
		previewDetail: defineQuery(apiContract.email.previewDetail, { scope: (): QueryKey => ["email", "preview-detail"] }),
		/** Sends one template to the configured test address. */
		previewSend: defineMutation(apiContract.email.previewSend),
		/** Every email-log list page — `scopeKey(undefined)` refetches them all (the SSE live view does). */
		logList: defineQuery(apiContract.email.logList, { scope: (): QueryKey => ["email", "log-list"] }),
	},

	geo: {
		stats: defineQuery(apiContract.geo.stats, { scope: (): QueryKey => ["geo", "stats"] }),
		countries: defineQuery(apiContract.geo.countries, { scope: (): QueryKey => ["geo", "countries"] }),
		states: defineQuery(apiContract.geo.states, { scope: (): QueryKey => ["geo", "states"] }),
		cities: defineQuery(apiContract.geo.cities, { scope: (): QueryKey => ["geo", "cities"] }),
	},

	rewards: {
		list: defineQuery(apiContract.rewards.list, { scope: (): QueryKey => ["rewards", "list"] }),
		detail: defineQuery(apiContract.rewards.detail, { scope: ({ rewardId }: { readonly rewardId: string }): QueryKey => ["rewards", "detail", rewardId] }),
	},
	legal: {
		accept: defineMutation(apiContract.legal.accept),
		status: defineQuery(apiContract.legal.status, { scope: (): QueryKey => ["legal", "status"] }),
	},
	claims: {
		otp: defineMutation(apiContract.claims.otp),
		create: defineMutation(apiContract.claims.create),
		list: defineQuery(apiContract.claims.list, { scope: (): QueryKey => ["claims", "list"] }),
		analytics: defineQuery(apiContract.claims.analytics, { scope: (): QueryKey => ["claims", "analytics"] }),
		/** The customer's analytics dashboard (custom range + interval); keyed under the `analytics` scope. */
		analyticsDashboard: defineQuery(apiContract.claims.analyticsDashboard, { scope: (): QueryKey => ["claims", "analytics", "dashboard"] }),
		qr: defineQuery(apiContract.claims.qr, { scope: ({ claimId }: { readonly claimId: string }): QueryKey => ["claims", "qr", claimId] }),
	},
	rewardNotifications: {
		list: defineQuery(apiContract.rewardNotifications.list, { scope: (): QueryKey => ["reward-notifications", "list"] }),
		read: defineMutation(apiContract.rewardNotifications.read),
	},
	files: {
		uploadUrl: defineMutation(apiContract.files.uploadUrl),
		complete: defineMutation(apiContract.files.complete),
		detail: defineQuery(apiContract.files.detail, { scope: ({ fileId }: { readonly fileId: string }): QueryKey => ["files", "detail", fileId] }),
		downloadUrl: defineQuery(apiContract.files.downloadUrl, { scope: ({ fileId }: { readonly fileId: string }): QueryKey => ["files", "download-url", fileId] }),
		delete: defineMutation(apiContract.files.delete),
	},
	organizations: {
		/** The member's organizations (membership + capabilities) — invalidate after any identity or membership change. */
		membershipsBootstrap: defineQuery(apiContract.organizations.membershipsBootstrap, { scope: (): QueryKey => ["organizations", "memberships"] }),
		context: defineQuery(apiContract.organizations.context, { scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "context"] }),
		listMembers: defineQuery(apiContract.organizations.listMembers, { scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "members", "list"] }),
		listMemberInvites: defineQuery(apiContract.organizations.listMemberInvites, {
			scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "members", "invites"],
		}),
		inviteMember: defineMutation(apiContract.organizations.inviteMember),
		revokeMemberInvite: defineMutation(apiContract.organizations.revokeMemberInvite),
		removeMemberFromStore: defineMutation(apiContract.organizations.removeMemberFromStore),
		/** The signed-in member's own membership (display name). Invalidate `context` and `listMembers` of the organization after it. */
		updateOwnMembership: defineMutation(apiContract.organizations.updateOwnMembership),
		validateTeamInvite: defineMutation(apiContract.organizations.validateTeamInvite),
		acceptTeamInvite: defineMutation(apiContract.organizations.acceptTeamInvite),
		registerAndAcceptTeamInvite: defineMutation(apiContract.organizations.registerAndAcceptTeamInvite, { baseOptions: { headers: clientTypeHeader("merchant") } }),
		kyb: {
			get: defineQuery(apiContract.organizations.kyb.get, { scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "kyb"] }),
			submit: defineMutation(apiContract.organizations.kyb.submit),
			downloadDocument: defineQuery(apiContract.organizations.kyb.downloadDocument, {
				scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "kyb", "documents", "download"],
			}),
		},
		rewards: {
			list: defineQuery(apiContract.organizations.rewards.list, { scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "rewards", "list"] }),
			get: defineQuery(apiContract.organizations.rewards.get, { scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "rewards", "detail"] }),
			create: defineMutation(apiContract.organizations.rewards.create),
			update: defineMutation(apiContract.organizations.rewards.update),
			publish: defineMutation(apiContract.organizations.rewards.publish),
		},
		apiKeys: {
			list: defineQuery(apiContract.organizations.apiKeys.list, { scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "api-keys", "list"] }),
			create: defineMutation(apiContract.organizations.apiKeys.create),
			revoke: defineMutation(apiContract.organizations.apiKeys.revoke),
		},
		terminals: {
			list: defineQuery(apiContract.organizations.terminals.list, { scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "terminals", "list"] }),
			summary: defineQuery(apiContract.organizations.terminals.summary, {
				scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "terminals", "summary"],
			}),
			get: defineQuery(apiContract.organizations.terminals.get, { scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "terminals", "detail"] }),
			create: defineMutation(apiContract.organizations.terminals.create),
			pairingCode: defineMutation(apiContract.organizations.terminals.pairingCode),
			remove: defineMutation(apiContract.organizations.terminals.remove),
			settings: defineQuery(apiContract.organizations.terminals.settings, {
				scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "terminals", "settings"],
			}),
			updateSettings: defineMutation(apiContract.organizations.terminals.updateSettings),
		},
		redemptions: defineQuery(apiContract.organizations.redemptions, { scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "redemptions"] }),
		analytics: defineQuery(apiContract.organizations.analytics, { scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "analytics"] }),
		/** The merchant analytics dashboard (custom range + interval, breakdowns); the export is `apiDownloads.organizations.analyticsExport`. */
		analyticsDashboard: defineQuery(apiContract.organizations.analyticsDashboard, {
			scope: ({ orgSlug }: OrganizationScope): QueryKey => ["organization", orgSlug, "analytics", "dashboard"],
		}),
		locations: {
			create: defineMutation(apiContract.organizations.locations.create),
			update: defineMutation(apiContract.organizations.locations.update),
			close: defineMutation(apiContract.organizations.locations.close),
		},
		onboarding: {
			validate: defineMutation(apiContract.organizations.onboarding.validate),
			complete: defineMutation(apiContract.organizations.onboarding.complete),
			documentUploadUrl: defineMutation(apiContract.organizations.onboarding.documentUploadUrl),
			documentBatchUploadUrl: defineMutation(apiContract.organizations.onboarding.documentBatchUploadUrl),
			documentUploadComplete: defineMutation(apiContract.organizations.onboarding.documentUploadComplete),
			documentBatchUploadComplete: defineMutation(apiContract.organizations.onboarding.documentBatchUploadComplete),
			documentsSubmit: defineMutation(apiContract.organizations.onboarding.documentsSubmit),
			// POST (the invite token stays out of URLs): poll it from a query whose queryFn calls `.mutate`.
			documentStatus: defineMutation(apiContract.organizations.onboarding.documentStatus),
		},
	},

	rewardsAdmin: {
		pendingRewards: defineQuery(apiContract.rewardsAdmin.pendingRewards, { scope: (): QueryKey => ["rewards-admin", "pending"] }),
		listOrganizations: defineQuery(apiContract.rewardsAdmin.listOrganizations, { scope: (): QueryKey => ["rewards-admin", "organizations"] }),
		getOrganization: defineQuery(apiContract.rewardsAdmin.getOrganization, {
			scope: ({ organizationId }: AdminOrganizationScope): QueryKey => ["rewards-admin", "organization", organizationId],
		}),
		downloadOrganizationDocument: defineQuery(apiContract.rewardsAdmin.downloadOrganizationDocument, {
			scope: ({ organizationId }: AdminOrganizationScope): QueryKey => ["rewards-admin", "organization", organizationId, "documents", "download"],
		}),
		createInvite: defineMutation(apiContract.rewardsAdmin.createInvite),
		previewInviteEmail: defineMutation(apiContract.rewardsAdmin.previewInviteEmail),
		salesAnalytics: defineQuery(apiContract.rewardsAdmin.salesAnalytics, { scope: (): QueryKey => ["rewards-admin", "analytics", "sales"] }),
		/** The platform analytics dashboard; the export is `apiDownloads.rewardsAdmin.analyticsExport`. */
		analyticsDashboard: defineQuery(apiContract.rewardsAdmin.analyticsDashboard, { scope: (): QueryKey => ["rewards-admin", "analytics", "dashboard"] }),
		approveReward: defineMutation(apiContract.rewardsAdmin.approveReward),
		rejectReward: defineMutation(apiContract.rewardsAdmin.rejectReward),
		updateKyb: defineMutation(apiContract.rewardsAdmin.updateKyb),
		listLocationRequests: defineQuery(apiContract.rewardsAdmin.listLocationRequests, { scope: (): QueryKey => ["rewards-admin", "location-requests"] }),
		createOrganizationLocation: defineMutation(apiContract.rewardsAdmin.createOrganizationLocation),
		reviewOrganizationLocation: defineMutation(apiContract.rewardsAdmin.reviewOrganizationLocation),
	},
	sampleCategory: {
		list: defineQuery(apiContract.sampleCategory.list, { scope: (): QueryKey => ["sample-category", "list"] }),
		detail: defineQuery(apiContract.sampleCategory.detail, { scope: ({ id }: { readonly id: string }): QueryKey => ["sample-category", "detail", id] }),
		create: defineMutation(apiContract.sampleCategory.create),
		bulkCreate: defineMutation(apiContract.sampleCategory.bulkCreate),
		bulkDelete: defineMutation(apiContract.sampleCategory.bulkDelete),
		update: defineMutation(apiContract.sampleCategory.update),
		delete: defineMutation(apiContract.sampleCategory.delete),
		restore: defineMutation(apiContract.sampleCategory.restore),
	},
	product: {
		list: defineQuery(apiContract.product.list, { scope: (): QueryKey => ["product", "list"] }),
		detail: defineQuery(apiContract.product.detail, { scope: ({ id }: { readonly id: string }): QueryKey => ["product", "detail", id] }),
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
