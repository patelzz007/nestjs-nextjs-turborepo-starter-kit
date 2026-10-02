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
// Only the client-side concerns stay here: the react-query key and the
// serialization knobs (`toQuery` / `toBody`).
//
// The input/output type parameters are CONSTRAINED (`SerializableInput` /
// `DataValue`) so the shared pipeline (dedupe map, observable, spec closures)
// can be typed end-to-end with generics — no type erasure, no `unknown`,
// no casts anywhere.

import type { QueryKey } from "@tanstack/react-query";
import {
	apiContract,
	flattenQueryParams,
	type ApiAccess,
	type ApiContractDef,
	type ApiVersion,
	type DataValue,
	type Envelope,
	type RestMethod,
	type SerializableInput,
} from "@workspace/shared";
import { z, type ZodType } from "zod";

// Every endpoint answers with the ResponseInterceptor envelope
// ({ success: true, data, meta }). Its exact schema comes from the shared
// contract leaf (`response: singleResponse(…)` / `paginatedResponse(…)`,
// ADR 022) — the client never re-declares a response shape, and the fetch
// layer parses every body with it (`parseResponseContract`).

/**
 * React-query key of a list endpoint: the resource prefix plus the WHOLE
 * parsed list query, so every page / limit / cursor / sort / filter / search
 * input is part of the key (no silently shared cache entries). Invalidate a
 * resource's lists with the prefix alone (`["product", "list"]`).
 */
export function listQueryKey(prefix: readonly string[], input: SerializableInput): QueryKey {
	return [...prefix, input];
}

/** Query-key prefix of every email-log list page — invalidate it to refetch them all (the SSE live view does). */
export const EMAIL_LOG_LIST_QUERY_KEY_PREFIX: readonly string[] = ["email", "log-list"];

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
	readonly baseOptions?: { readonly headers?: Record<string, string> | undefined } | undefined;
}

/** A POST/PUT/PATCH/DELETE procedure: input → path params + JSON body, response → typed payload. */
export interface MutationDef<Input extends SerializableInput, Resp extends DataValue> {
	readonly kind: "mutation";
	readonly method: Exclude<RestMethod, "GET">;
	readonly path: string;
	/** API version for this leaf — see `QueryDef.version`. */
	readonly version?: ApiVersion | undefined;
	readonly inputSchema: ZodType<Input>;
	readonly responseSchema: ZodType<Resp>;
	readonly queryKey: (input: Input) => QueryKey;
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

const ProcedureLeafShapeSchema = z.discriminatedUnion("kind", [
	z.looseObject({
		kind: z.literal("query"),
		method: z.literal("GET"),
		path: z.string(),
		inputSchema: z.custom<ZodType<SerializableInput>>(),
		responseSchema: z.custom<ZodType<DataValue>>(),
	}),
	z.looseObject({
		kind: z.literal("mutation"),
		method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
		path: z.string(),
		inputSchema: z.custom<ZodType<SerializableInput>>(),
		responseSchema: z.custom<ZodType<DataValue>>(),
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

/** Prefixes a query key with the version when a leaf opts out of the default — v2 keys can never collide with v1 cache entries. */
function versionedKey(version: ApiVersion | undefined, base: QueryKey): QueryKey {
	return version === undefined ? base : [version, ...base];
}

/**
 * Declares a GET procedure from its shared contract leaf. The contract owns
 * method + path + input + response envelope; this layer adds the query key.
 */
export function defineQuery<Input extends SerializableInput, Data extends DataValue>(
	contract: ApiContractDef<Input, "GET", Data>,
	opts: {
		readonly queryKey: (input: Input) => QueryKey;
		readonly baseOptions?: { readonly headers?: Record<string, string> | undefined } | undefined;
	},
): QueryDef<Input, Envelope<Data>> {
	return {
		kind: "query",
		method: "GET",
		path: contract.path,
		version: contract.version,
		access: contract.access ?? "authenticated",
		inputSchema: contract.input,
		responseSchema: contract.response.envelope,
		queryKey: (input: Input): QueryKey => versionedKey(contract.version, opts.queryKey(input)),
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
		readonly queryKey: (input: Input) => QueryKey;
		readonly baseOptions?: { readonly headers?: Record<string, string> | undefined } | undefined;
		readonly toBody?: ((input: Input) => DataValue) | undefined;
		readonly toQuery?: readonly string[] | undefined;
	},
): MutationDef<Input, Envelope<Data>> {
	return {
		kind: "mutation",
		method: contract.method,
		path: contract.path,
		version: contract.version,
		inputSchema: contract.input,
		responseSchema: contract.response.envelope,
		queryKey: (input: Input): QueryKey => versionedKey(contract.version, opts.queryKey(input)),
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
// and only adds the client-side query key. Adding a route = adding one
// contract leaf in `@workspace/shared` + one def here + one pipe in the API
// controller — a missing leaf is a compile error on the client and a 400 on
// the API side.

export const apiRouter = {
	auth: {
		/** "Who am I?" — profile without permissions. */
		me: defineQuery(apiContract.auth.me, {
			queryKey: () => ["auth", "me"],
		}),
		/** Session roles + permissions — refetch after RBAC mutations. */
		permissions: defineQuery(apiContract.auth.permissions, {
			queryKey: () => ["auth", "permissions"],
		}),
		/** Very basic protected endpoint — proves the access token is valid and answers "who am I + when does my token expire" with no DB work. */
		sessionStatus: defineQuery(apiContract.auth.sessionStatus, {
			queryKey: () => ["auth", "session-status"],
		}),
		login: defineMutation(apiContract.auth.login, {
			queryKey: () => ["auth", "login"],
		}),
		/** Admin login — sends `X-Client-Type: admin` for cookie isolation. */
		adminLogin: defineMutation(apiContract.auth.adminLogin, {
			queryKey: () => ["auth", "admin-login"],
			baseOptions: { headers: { "X-Client-Type": "admin" } },
		}),
		/** Merchant login — sends `X-Client-Type: merchant` for cookie isolation. */
		merchantLogin: defineMutation(apiContract.auth.login, {
			queryKey: () => ["auth", "merchant-login"],
			baseOptions: { headers: { "X-Client-Type": "merchant" } },
		}),
		signup: defineMutation(apiContract.auth.signup, {
			queryKey: () => ["auth", "signup"],
		}),
		refresh: defineMutation(apiContract.auth.refresh, {
			queryKey: () => ["auth", "refresh"],
		}),
		logout: defineMutation(apiContract.auth.logout, {
			queryKey: () => ["auth", "logout"],
		}),
		forgotPassword: defineMutation(apiContract.auth.forgotPassword, {
			queryKey: () => ["auth", "forgot-password"],
		}),
		resetPassword: defineMutation(apiContract.auth.resetPassword, {
			queryKey: () => ["auth", "reset-password"],
		}),
		validateResetToken: defineMutation(apiContract.auth.validateResetToken, {
			queryKey: () => ["auth", "validate-reset-token"],
		}),
		resendVerification: defineMutation(apiContract.auth.resendVerification, {
			queryKey: () => ["auth", "resend-verification"],
		}),
		verifyEmail: defineMutation(apiContract.auth.verifyEmail, {
			queryKey: ({ token }) => ["auth", "verify-email", token],
		}),
		changePassword: defineMutation(apiContract.auth.changePassword, {
			queryKey: () => ["auth", "change-password"],
		}),
		loginTwoFactor: defineMutation(apiContract.auth.loginTwoFactor, {
			queryKey: () => ["auth", "login-2fa"],
		}),
		loginBackupCode: defineMutation(apiContract.auth.loginBackupCode, {
			queryKey: () => ["auth", "login-backup-code"],
		}),
		verifyLogin: defineMutation(apiContract.auth.verifyLogin, {
			queryKey: () => ["auth", "verify-login"],
		}),
		twoFactorSetup: defineQuery(apiContract.auth.twoFactorSetup, {
			queryKey: () => ["auth", "2fa-setup"],
		}),
		twoFactorEnable: defineMutation(apiContract.auth.twoFactorEnable, {
			queryKey: () => ["auth", "2fa-enable"],
		}),
		twoFactorRotate: defineMutation(apiContract.auth.twoFactorRotate, {
			queryKey: () => ["auth", "2fa-rotate"],
		}),
		twoFactorBackupCodesRemaining: defineQuery(apiContract.auth.twoFactorBackupCodesRemaining, {
			queryKey: () => ["auth", "2fa-backup-codes-remaining"],
		}),
		twoFactorVerifyBackupCode: defineMutation(apiContract.auth.twoFactorVerifyBackupCode, {
			queryKey: () => ["auth", "2fa-verify-backup-code"],
		}),
		mfaRecoveryInitiate: defineMutation(apiContract.auth.mfaRecoveryInitiate, {
			queryKey: () => ["auth", "mfa-recovery-initiate"],
		}),
		mfaRecoveryStatus: defineQuery(apiContract.auth.mfaRecoveryStatus, {
			queryKey: () => ["auth", "mfa-recovery-status"],
		}),
		adminMfaRecoveryReview: defineMutation(apiContract.auth.adminMfaRecoveryReview, {
			queryKey: ({ requestId, action }) => ["auth", "admin-mfa-recovery-review", requestId, action],
		}),
		adminMfaRecoveryRequests: defineQuery(apiContract.auth.adminMfaRecoveryRequests, {
			queryKey: (input) => listQueryKey(["auth", "admin-mfa-recovery-requests"], input),
		}),
		adminUsers: defineQuery(apiContract.auth.adminUsers, {
			queryKey: (input) => listQueryKey(["auth", "admin-users"], input),
		}),
		adminUserDetail: defineQuery(apiContract.auth.adminUserDetail, {
			queryKey: ({ userId }) => ["auth", "admin-user", userId],
		}),
		impersonate: defineMutation(apiContract.auth.impersonate, {
			queryKey: ({ userId }) => ["auth", "impersonate", userId],
		}),
		stopImpersonation: defineMutation(apiContract.auth.stopImpersonation, {
			queryKey: () => ["auth", "stop-impersonation"],
		}),
	},

	capabilities: {
		catalog: defineQuery(apiContract.capabilities.catalog, {
			queryKey: ({ scope }) => ["capabilities", "catalog", scope ?? "all"],
		}),
	},

	admin: {
		roles: {
			list: defineQuery(apiContract.admin.roles.list, {
				queryKey: () => ["admin", "roles", "list"],
			}),
			userAssign: defineMutation(apiContract.admin.roles.userAssign, {
				queryKey: ({ userId }) => ["admin", "roles", "user-assign", userId],
			}),
			userRemove: defineMutation(apiContract.admin.roles.userRemove, {
				queryKey: ({ userId }) => ["admin", "roles", "user-remove", userId],
			}),
			userSync: defineMutation(apiContract.admin.roles.userSync, {
				queryKey: ({ userId }) => ["admin", "roles", "user-sync", userId],
			}),
		},
		permissions: {
			list: defineQuery(apiContract.admin.permissions.list, {
				queryKey: () => ["admin", "permissions", "list"],
			}),
			check: defineMutation(apiContract.admin.permissions.check, {
				queryKey: ({ userId, action, resource }) => ["admin", "permissions", "check", userId, action, resource],
			}),
			userGrant: defineMutation(apiContract.admin.permissions.userGrant, {
				queryKey: ({ userId }) => ["admin", "permissions", "user-grant", userId],
			}),
			userRevoke: defineMutation(apiContract.admin.permissions.userRevoke, {
				queryKey: ({ userId }) => ["admin", "permissions", "user-revoke", userId],
			}),
			userSync: defineMutation(apiContract.admin.permissions.userSync, {
				queryKey: ({ userId }) => ["admin", "permissions", "user-sync", userId],
			}),
		},
	},

	// ── Email template preview procedures ─────────────────────────────────────
	email: {
		previewList: defineQuery(apiContract.email.previewList, {
			queryKey: () => ["email", "preview-list"],
		}),
		/** Preview detail for one template key. */
		previewDetail: defineQuery(apiContract.email.previewDetail, {
			queryKey: ({ key }) => ["email", "preview-detail", key],
		}),
		/** Sends one template to the configured test address. */
		previewSend: defineMutation(apiContract.email.previewSend, {
			queryKey: ({ key }) => ["email", "preview-send", key],
		}),
		logList: defineQuery(apiContract.email.logList, {
			queryKey: (input) => listQueryKey(EMAIL_LOG_LIST_QUERY_KEY_PREFIX, input),
		}),
	},

	geo: {
		stats: defineQuery(apiContract.geo.stats, {
			queryKey: () => ["geo", "stats"],
		}),
		countries: defineQuery(apiContract.geo.countries, {
			queryKey: (input) => listQueryKey(["geo", "countries"], input),
		}),
		states: defineQuery(apiContract.geo.states, {
			queryKey: (input) => listQueryKey(["geo", "states"], input),
		}),
		cities: defineQuery(apiContract.geo.cities, {
			queryKey: (input) => listQueryKey(["geo", "cities"], input),
		}),
	},

	rewards: {
		list: defineQuery(apiContract.rewards.list, {
			queryKey: (input) => listQueryKey(["rewards", "list"], input),
		}),
		detail: defineQuery(apiContract.rewards.detail, {
			queryKey: ({ rewardId }) => ["rewards", "detail", rewardId],
		}),
	},
	legal: {
		accept: defineMutation(apiContract.legal.accept, {
			queryKey: ({ termsVersion, privacyVersion }) => ["legal", "accept", termsVersion, privacyVersion],
		}),
		status: defineQuery(apiContract.legal.status, {
			queryKey: () => ["legal", "status"],
		}),
	},
	claims: {
		otp: defineMutation(apiContract.claims.otp, {
			queryKey: ({ rewardId, phone }) => ["claims", "otp", rewardId, phone],
		}),
		create: defineMutation(apiContract.claims.create, {
			queryKey: ({ rewardId }) => ["claims", "create", rewardId],
		}),
		list: defineQuery(apiContract.claims.list, {
			queryKey: (input) => listQueryKey(["claims", "list"], input),
		}),
		analytics: defineQuery(apiContract.claims.analytics, {
			queryKey: ({ from, to }) => ["claims", "analytics", from, to],
		}),
		qr: defineQuery(apiContract.claims.qr, {
			queryKey: ({ claimId }) => ["claims", "qr", claimId],
		}),
	},
	rewardNotifications: {
		list: defineQuery(apiContract.rewardNotifications.list, {
			queryKey: (input) => listQueryKey(["reward-notifications", "list"], input),
		}),
		read: defineMutation(apiContract.rewardNotifications.read, {
			queryKey: () => ["reward-notifications", "read"],
		}),
	},
	files: {
		uploadUrl: defineMutation(apiContract.files.uploadUrl, {
			queryKey: ({ category, fileName }) => ["files", "upload-url", category, fileName],
		}),
		complete: defineMutation(apiContract.files.complete, {
			queryKey: ({ fileId }) => ["files", "complete", fileId],
		}),
		detail: defineQuery(apiContract.files.detail, {
			queryKey: ({ fileId }) => ["files", "detail", fileId],
		}),
		downloadUrl: defineQuery(apiContract.files.downloadUrl, {
			queryKey: ({ fileId }) => ["files", "download-url", fileId],
		}),
		delete: defineMutation(apiContract.files.delete, {
			queryKey: ({ fileId }) => ["files", "delete", fileId],
		}),
	},
	organizations: {
		membershipsBootstrap: defineQuery(apiContract.organizations.membershipsBootstrap, {
			queryKey: () => ["organizations", "memberships"],
		}),
		context: defineQuery(apiContract.organizations.context, {
			queryKey: ({ orgSlug }) => ["organization", orgSlug, "context"],
		}),
		listMembers: defineQuery(apiContract.organizations.listMembers, {
			queryKey: ({ orgSlug }) => ["organization", orgSlug, "members"],
		}),
		listMemberInvites: defineQuery(apiContract.organizations.listMemberInvites, {
			queryKey: ({ orgSlug }) => ["organization", orgSlug, "members", "invites"],
		}),
		inviteMember: defineMutation(apiContract.organizations.inviteMember, {
			queryKey: ({ orgSlug, email }) => ["organization", orgSlug, "members", "invite", email],
		}),
		revokeMemberInvite: defineMutation(apiContract.organizations.revokeMemberInvite, {
			queryKey: ({ orgSlug, inviteId }) => ["organization", orgSlug, "members", "invites", "revoke", inviteId],
		}),
		validateTeamInvite: defineMutation(apiContract.organizations.validateTeamInvite, {
			queryKey: ({ token }) => ["organization", "team-invite", "validate", token],
		}),
		acceptTeamInvite: defineMutation(apiContract.organizations.acceptTeamInvite, {
			queryKey: ({ token }) => ["organization", "team-invite", "accept", token],
		}),
		registerAndAcceptTeamInvite: defineMutation(apiContract.organizations.registerAndAcceptTeamInvite, {
			queryKey: ({ token }) => ["organization", "team-invite", "register-and-accept", token],
			baseOptions: { headers: { "X-Client-Type": "merchant" } },
		}),
		kyb: {
			get: defineQuery(apiContract.organizations.kyb.get, {
				queryKey: ({ orgSlug }) => ["organization", orgSlug, "kyb"],
			}),
			submit: defineMutation(apiContract.organizations.kyb.submit, {
				queryKey: ({ orgSlug }) => ["organization", orgSlug, "kyb", "submit"],
			}),
			downloadDocument: defineQuery(apiContract.organizations.kyb.downloadDocument, {
				queryKey: ({ orgSlug, documentId, disposition }) => ["organization", orgSlug, "kyb", "documents", "download", documentId, disposition],
			}),
		},
		rewards: {
			list: defineQuery(apiContract.organizations.rewards.list, {
				queryKey: ({ orgSlug, locationId }) => ["organization", orgSlug, "rewards", "list", locationId],
			}),
			create: defineMutation(apiContract.organizations.rewards.create, {
				queryKey: ({ orgSlug, title }) => ["organization", orgSlug, "rewards", "create", title],
			}),
			update: defineMutation(apiContract.organizations.rewards.update, {
				queryKey: ({ orgSlug, rewardId }) => ["organization", orgSlug, "rewards", "update", rewardId],
			}),
			publish: defineMutation(apiContract.organizations.rewards.publish, {
				queryKey: ({ orgSlug, rewardId }) => ["organization", orgSlug, "rewards", "publish", rewardId],
			}),
		},
		apiKeys: {
			list: defineQuery(apiContract.organizations.apiKeys.list, {
				queryKey: (input) => listQueryKey(["organization", input.orgSlug, "api-keys", "list"], input),
			}),
			create: defineMutation(apiContract.organizations.apiKeys.create, {
				queryKey: ({ orgSlug, name }) => ["organization", orgSlug, "api-keys", "create", name],
			}),
			revoke: defineMutation(apiContract.organizations.apiKeys.revoke, {
				queryKey: ({ orgSlug, keyId }) => ["organization", orgSlug, "api-keys", "revoke", keyId],
			}),
		},
		terminals: {
			list: defineQuery(apiContract.organizations.terminals.list, {
				queryKey: (input) => listQueryKey(["organization", input.orgSlug, "terminals", "list"], input),
			}),
			create: defineMutation(apiContract.organizations.terminals.create, {
				queryKey: ({ orgSlug, name }) => ["organization", orgSlug, "terminals", "create", name],
			}),
			pairingCode: defineMutation(apiContract.organizations.terminals.pairingCode, {
				queryKey: ({ orgSlug, id }) => ["organization", orgSlug, "terminals", "pairing-code", id],
			}),
			remove: defineMutation(apiContract.organizations.terminals.remove, {
				queryKey: ({ orgSlug, id }) => ["organization", orgSlug, "terminals", "remove", id],
			}),
			settings: defineQuery(apiContract.organizations.terminals.settings, {
				queryKey: ({ orgSlug }) => ["organization", orgSlug, "terminals", "settings"],
			}),
			updateSettings: defineMutation(apiContract.organizations.terminals.updateSettings, {
				queryKey: ({ orgSlug }) => ["organization", orgSlug, "terminals", "settings", "update"],
			}),
		},
		redemptions: defineQuery(apiContract.organizations.redemptions, {
			queryKey: (input) => listQueryKey(["organization", input.orgSlug, "redemptions"], input),
		}),
		analytics: defineQuery(apiContract.organizations.analytics, {
			queryKey: ({ orgSlug, from, to, locationId }) => ["organization", orgSlug, "analytics", locationId, from, to],
		}),
		locations: {
			create: defineMutation(apiContract.organizations.locations.create, {
				queryKey: ({ orgSlug, name }) => ["organization", orgSlug, "locations", "create", name],
			}),
			update: defineMutation(apiContract.organizations.locations.update, {
				queryKey: ({ orgSlug, locationId }) => ["organization", orgSlug, "locations", "update", locationId],
			}),
		},
		onboarding: {
			validate: defineMutation(apiContract.organizations.onboarding.validate, {
				queryKey: ({ token }) => ["organization", "onboarding", "validate", token],
			}),
			complete: defineMutation(apiContract.organizations.onboarding.complete, {
				queryKey: ({ token }) => ["organization", "onboarding", "complete", token],
			}),
			documentUploadUrl: defineMutation(apiContract.organizations.onboarding.documentUploadUrl, {
				queryKey: ({ token, fileName }) => ["organization", "onboarding", "document-upload-url", token, fileName],
			}),
			documentBatchUploadUrl: defineMutation(apiContract.organizations.onboarding.documentBatchUploadUrl, {
				queryKey: ({ token }) => ["organization", "onboarding", "document-batch-upload-url", token],
			}),
			documentUploadComplete: defineMutation(apiContract.organizations.onboarding.documentUploadComplete, {
				queryKey: ({ token, fileId }) => ["organization", "onboarding", "document-upload-complete", token, fileId],
			}),
			documentBatchUploadComplete: defineMutation(apiContract.organizations.onboarding.documentBatchUploadComplete, {
				queryKey: ({ token }) => ["organization", "onboarding", "document-batch-upload-complete", token],
			}),
			documentsSubmit: defineMutation(apiContract.organizations.onboarding.documentsSubmit, {
				queryKey: ({ token }) => ["organization", "onboarding", "documents-submit", token],
			}),
		},
	},

	rewardsAdmin: {
		pendingRewards: defineQuery(apiContract.rewardsAdmin.pendingRewards, {
			queryKey: () => ["rewards-admin", "pending"],
		}),
		listOrganizations: defineQuery(apiContract.rewardsAdmin.listOrganizations, {
			queryKey: (input) => listQueryKey(["rewards-admin", "organizations"], input),
		}),
		getOrganization: defineQuery(apiContract.rewardsAdmin.getOrganization, {
			queryKey: ({ organizationId }) => ["rewards-admin", "organization", organizationId],
		}),
		downloadOrganizationDocument: defineQuery(apiContract.rewardsAdmin.downloadOrganizationDocument, {
			queryKey: ({ organizationId, documentId, disposition }) => ["rewards-admin", "organization", organizationId, "documents", "download", documentId, disposition],
		}),
		createInvite: defineMutation(apiContract.rewardsAdmin.createInvite, {
			queryKey: ({ email }) => ["rewards-admin", "invite", email],
		}),
		previewInviteEmail: defineMutation(apiContract.rewardsAdmin.previewInviteEmail, {
			queryKey: ({ email, businessName, city }) => ["rewards-admin", "invite-preview", email, businessName, city],
		}),
		salesAnalytics: defineQuery(apiContract.rewardsAdmin.salesAnalytics, {
			queryKey: ({ from, to }) => ["rewards-admin", "analytics", "sales", from, to],
		}),
		approveReward: defineMutation(apiContract.rewardsAdmin.approveReward, {
			queryKey: ({ rewardId }) => ["rewards-admin", "approve", rewardId],
		}),
		rejectReward: defineMutation(apiContract.rewardsAdmin.rejectReward, {
			queryKey: ({ rewardId }) => ["rewards-admin", "reject", rewardId],
		}),
		updateKyb: defineMutation(apiContract.rewardsAdmin.updateKyb, {
			queryKey: ({ organizationId }) => ["rewards-admin", "kyb", organizationId],
		}),
		listLocationRequests: defineQuery(apiContract.rewardsAdmin.listLocationRequests, {
			queryKey: (input) => listQueryKey(["rewards-admin", "location-requests"], input),
		}),
		createOrganizationLocation: defineMutation(apiContract.rewardsAdmin.createOrganizationLocation, {
			queryKey: ({ organizationId, name }) => ["rewards-admin", "organization", organizationId, "locations", "create", name],
		}),
		reviewOrganizationLocation: defineMutation(apiContract.rewardsAdmin.reviewOrganizationLocation, {
			queryKey: ({ organizationId, locationId, approve }) => ["rewards-admin", "organization", organizationId, "locations", locationId, "review", approve],
		}),
	},
	sampleCategory: {
		list: defineQuery(apiContract.sampleCategory.list, {
			queryKey: (input) => listQueryKey(["sample-category", "list"], input),
		}),
		detail: defineQuery(apiContract.sampleCategory.detail, {
			queryKey: ({ id }) => ["sample-category", "detail", id],
		}),
		create: defineMutation(apiContract.sampleCategory.create, {
			queryKey: ({ name }) => ["sample-category", "create", name],
		}),
		bulkCreate: defineMutation(apiContract.sampleCategory.bulkCreate, {
			queryKey: ({ items }) => ["sample-category", "bulk-create", String(items.length)],
		}),
		bulkDelete: defineMutation(apiContract.sampleCategory.bulkDelete, {
			queryKey: ({ ids }) => ["sample-category", "bulk-delete", ...ids],
		}),
		update: defineMutation(apiContract.sampleCategory.update, {
			queryKey: ({ id }) => ["sample-category", "update", id],
		}),
		delete: defineMutation(apiContract.sampleCategory.delete, {
			queryKey: ({ id }) => ["sample-category", "delete", id],
		}),
		restore: defineMutation(apiContract.sampleCategory.restore, {
			queryKey: ({ id }) => ["sample-category", "restore", id],
		}),
	},
	product: {
		list: defineQuery(apiContract.product.list, {
			queryKey: (input) => listQueryKey(["product", "list"], input),
		}),
		detail: defineQuery(apiContract.product.detail, {
			queryKey: ({ id }) => ["product", "detail", id],
		}),
		create: defineMutation(apiContract.product.create, {
			queryKey: ({ name }) => ["product", "create", name],
		}),
		bulkCreate: defineMutation(apiContract.product.bulkCreate, {
			queryKey: ({ items }) => ["product", "bulk-create", String(items.length)],
		}),
		bulkDelete: defineMutation(apiContract.product.bulkDelete, {
			queryKey: ({ ids }) => ["product", "bulk-delete", ...ids],
		}),
		update: defineMutation(apiContract.product.update, {
			queryKey: ({ id }) => ["product", "update", id],
		}),
		delete: defineMutation(apiContract.product.delete, {
			queryKey: ({ id }) => ["product", "delete", id],
		}),
		restore: defineMutation(apiContract.product.restore, {
			queryKey: ({ id }) => ["product", "restore", id],
		}),
	},
};

/** The full router tree — used to derive the client router + server caller types. */
export type ApiRouter = typeof apiRouter;
