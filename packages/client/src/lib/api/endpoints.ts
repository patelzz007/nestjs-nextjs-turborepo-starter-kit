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
// The route contract (method + path + input schema) lives in
// `@workspace/shared` (`apiContract`) — this module derives every def from it,
// so the client router and the API's boundary validation can never drift.
// Only the client-side concerns stay here: the response envelope schema, the
// react-query key, and the serialization knobs (`toQuery` / `toBody`).
//
// The input/output type parameters are CONSTRAINED (`SerializableInput` /
// `DataValue`) so the shared pipeline (dedupe map, observable, spec closures)
// can be typed end-to-end with generics — no type erasure, no `unknown`,
// no casts anywhere.

import type { QueryKey } from "@tanstack/react-query";
import {
	// ── Contract & shared types ───────────────────────────────────────
	apiContract,
	ApiPaginatedMetaSchema,
	ApiResponseMetaSchema,
	type Envelope,
	type ApiContractDef,
	type ApiResponseMeta,
	type ApiVersion,
	type DataValue,
	type RestMethod,
	type SerializableInput,

	// ── Auth response schemas ──────────────────────────────────────────
	AdminUserDetailSchema,
	CheckPermissionResponseSchema,
	CapabilityDefinitionSchema,
	DataValueSchema,
	ForgotPasswordResponseSchema,
	ImpersonateResponseSchema,
	LoginResponseSchema,
	LogoutResponseSchema,
	PermissionListResponseSchema,
	RbacMessageResponseSchema,
	RefreshResponseSchema,
	ResendVerificationResponseSchema,
	ResetPasswordResponseSchema,
	RoleListResponseSchema,
	SessionPermissionsResponseSchema,
	SessionStatusSchema,
	SignupResponseSchema,
	StopImpersonationResponseSchema,
	UserResponseSchema,
	VerifyEmailResponseSchema,

	// ── Email schemas ─────────────────────────────────────────────────
	EmailLogListResponseSchema,
	EmailPreviewListResponseSchema,
	EmailPreviewSchema,
	EmailSendResultSchema,

	// ── Geo schemas ──────────────────────────────────────────────────
	CitySchema,
	CountrySchema,
	StateSchema,

	// ── Rewards admin schemas ────────────────────────────────────────
	AdminMerchantInviteCreatedResponseSchema,
	MerchantApiKeyCreatedSchema,
	MerchantApiKeySummarySchema,
	MerchantMembershipResponseSchema,
	MerchantRoleCapabilityGrantSchema,
	MerchantOrgResponseSchema,
	MerchantRedemptionListItemSchema,
	MerchantAnalyticsResponseSchema,
	RewardClaimCreatedResponseSchema,
	RewardClaimQrResponseSchema,
	RewardClaimResponseSchema,
	RewardNotificationResponseSchema,
	RewardResponseSchema,
	UserRewardsAnalyticsResponseSchema,
} from "@workspace/shared";
import { z, type ZodType } from "zod";

const OkResponseSchema = z.object({ ok: z.literal(true) }).strict();

const RewardNotificationListResponseSchema = z
	.object({
		items: z.array(RewardNotificationResponseSchema),
		unreadCount: z.number().int().nonnegative(),
	})
	.strict();
// Every endpoint returns the ResponseInterceptor envelope:
// { success: true, data, meta }. We build a typed envelope schema per endpoint
// so the FE knows the exact shape without `any` or `z.unknown`.

function envelope<Data extends DataValue>(dataSchema: ZodType<Data>, metaSchema: ZodType<ApiResponseMeta> = ApiResponseMetaSchema): ZodType<Envelope<Data>> {
	return z
		.object({
			success: z.literal(true),
			data: dataSchema,
			meta: metaSchema,
		})
		.strict();
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
	readonly version?: ApiVersion;
	/** Single typed input, validated before every call (tRPC-style). */
	readonly inputSchema: ZodType<Input>;
	readonly responseSchema: ZodType<Resp>;
	/** Derives the react-query key from the (parsed) input — server and client MUST agree. */
	readonly queryKey: (input: Input) => QueryKey;
	readonly baseOptions?: { readonly headers?: Record<string, string> };
}

/** A POST/PUT/PATCH/DELETE procedure: input → path params + JSON body, response → typed payload. */
export interface MutationDef<Input extends SerializableInput, Resp extends DataValue> {
	readonly kind: "mutation";
	readonly method: Exclude<RestMethod, "GET">;
	readonly path: string;
	/** API version for this leaf — see `QueryDef.version`. */
	readonly version?: ApiVersion;
	readonly inputSchema: ZodType<Input>;
	readonly responseSchema: ZodType<Resp>;
	readonly queryKey: (input: Input) => QueryKey;
	readonly baseOptions?: { readonly headers?: Record<string, string> };
	/**
	 * Maps the input to the request body. Default: every input key not consumed
	 * by a `:param` segment or listed in `toQuery`.
	 */
	readonly toBody?: (input: Input) => DataValue;
	/** Input keys routed to the QUERY string instead of the body (e.g. `prune({ force })`). */
	readonly toQuery?: readonly string[];
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

/**
 * Declares a GET procedure from its shared contract leaf. The contract owns
 * method + path + input; this layer adds the response envelope + query key.
 */
/** Prefixes a query key with the version when a leaf opts out of the default — v2 keys can never collide with v1 cache entries. */
function versionedKey(version: ApiVersion | undefined, base: QueryKey): QueryKey {
	return version === undefined ? base : [version, ...base];
}

export function defineQuery<Input extends SerializableInput, Resp extends DataValue>(
	contract: ApiContractDef<Input, "GET">,
	opts: {
		readonly response: ZodType<Resp>;
		readonly queryKey: (input: Input) => QueryKey;
		readonly baseOptions?: { readonly headers?: Record<string, string> };
	},
): QueryDef<Input, Resp> {
	return {
		kind: "query",
		method: "GET",
		path: contract.path,
		version: contract.version,
		inputSchema: contract.input,
		responseSchema: opts.response,
		queryKey: (input: Input): QueryKey => versionedKey(contract.version, opts.queryKey(input)),
		baseOptions: opts.baseOptions,
	};
}

/**
 * Declares a POST (or PUT/PATCH/DELETE) procedure from its shared contract
 * leaf. `toQuery` routes input keys to the query string instead of the body.
 */
export function defineMutation<Input extends SerializableInput, Resp extends DataValue, M extends Exclude<RestMethod, "GET">>(
	contract: ApiContractDef<Input, M>,
	opts: {
		readonly response: ZodType<Resp>;
		readonly queryKey: (input: Input) => QueryKey;
		readonly baseOptions?: { readonly headers?: Record<string, string> };
		readonly toBody?: (input: Input) => DataValue;
		readonly toQuery?: readonly string[];
	},
): MutationDef<Input, Resp> {
	return {
		kind: "mutation",
		method: contract.method,
		path: contract.path,
		version: contract.version,
		inputSchema: contract.input,
		responseSchema: opts.response,
		queryKey: (input: Input): QueryKey => versionedKey(contract.version, opts.queryKey(input)),
		baseOptions: opts.baseOptions,
		toBody: opts.toBody,
		toQuery: opts.toQuery,
	};
}

// ── REST serialization (shared by client + server) ─────────────────────────

const PARAM_PATTERN = /:([A-Za-z0-9_]+)/g;

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
export function resolveRequest(path: string, input: SerializableInput, options?: { readonly method?: RestMethod; readonly toQuery?: readonly string[] }): ResolvedRequest {
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
			const search = new URLSearchParams();
			for (const { key, value } of leftover) search.set(key, stringifyQueryValue(value));
			const qs = search.toString();
			url = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
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
		const search = new URLSearchParams();
		for (const { key, value } of toQueryEntries) search.set(key, stringifyQueryValue(value));
		const qs = search.toString();
		url = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
	}

	const body: Record<string, DataValue> = {};
	for (const { key, value } of leftover) body[key] = value;
	return { url, body };
}

/** Serializes a query value without tripping no-base-to-string on arbitrary values. */
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
// Every leaf derives path/method/input from `apiContract` (shared) and only
// adds the client-side envelope + query key. Adding a route = adding one
// contract leaf in `@workspace/shared` + one def here + one pipe in the API
// controller — a missing leaf is a compile error on the client and a 400 on
// the API side.

export const apiRouter = {
	auth: {
		/** "Who am I?" — profile without permissions. */
		me: defineQuery(apiContract.auth.me, {
			response: envelope(UserResponseSchema),
			queryKey: () => ["auth", "me"],
		}),
		/** Session roles + permissions — refetch after RBAC mutations. */
		permissions: defineQuery(apiContract.auth.permissions, {
			response: envelope(SessionPermissionsResponseSchema),
			queryKey: () => ["auth", "permissions"],
		}),
		/** Very basic protected endpoint — proves the access token is valid and answers "who am I + when does my token expire" with no DB work. */
		sessionStatus: defineQuery(apiContract.auth.sessionStatus, {
			response: envelope(SessionStatusSchema),
			queryKey: () => ["auth", "session-status"],
		}),
		login: defineMutation(apiContract.auth.login, {
			response: envelope(LoginResponseSchema),
			queryKey: () => ["auth", "login"],
		}),
		/** Admin login — sends `X-Client-Type: admin` for cookie isolation. */
		adminLogin: defineMutation(apiContract.auth.adminLogin, {
			response: envelope(LoginResponseSchema),
			queryKey: () => ["auth", "admin-login"],
			baseOptions: { headers: { "X-Client-Type": "admin" } },
		}),
		/** Merchant login — sends `X-Client-Type: merchant` for cookie isolation. */
		merchantLogin: defineMutation(apiContract.auth.login, {
			response: envelope(LoginResponseSchema),
			queryKey: () => ["auth", "merchant-login"],
			baseOptions: { headers: { "X-Client-Type": "merchant" } },
		}),
		signup: defineMutation(apiContract.auth.signup, {
			response: envelope(SignupResponseSchema),
			queryKey: () => ["auth", "signup"],
		}),
		refresh: defineMutation(apiContract.auth.refresh, {
			response: envelope(RefreshResponseSchema),
			queryKey: () => ["auth", "refresh"],
		}),
		logout: defineMutation(apiContract.auth.logout, {
			response: envelope(LogoutResponseSchema),
			queryKey: () => ["auth", "logout"],
		}),
		forgotPassword: defineMutation(apiContract.auth.forgotPassword, {
			response: envelope(ForgotPasswordResponseSchema),
			queryKey: () => ["auth", "forgot-password"],
		}),
		resetPassword: defineMutation(apiContract.auth.resetPassword, {
			response: envelope(ResetPasswordResponseSchema),
			queryKey: () => ["auth", "reset-password"],
		}),
		resendVerification: defineMutation(apiContract.auth.resendVerification, {
			response: envelope(ResendVerificationResponseSchema),
			queryKey: () => ["auth", "resend-verification"],
		}),
		verifyEmail: defineMutation(apiContract.auth.verifyEmail, {
			response: envelope(VerifyEmailResponseSchema),
			queryKey: ({ token }) => ["auth", "verify-email", token],
		}),
		adminUsers: defineQuery(apiContract.auth.adminUsers, {
			response: envelope(z.array(AdminUserDetailSchema), ApiPaginatedMetaSchema),
			queryKey: ({ page, limit, search, sort, role, status }) => ["auth", "admin-users", page, limit, search, sort, role, status],
		}),
		adminUserDetail: defineQuery(apiContract.auth.adminUserDetail, {
			response: envelope(AdminUserDetailSchema),
			queryKey: ({ userId }) => ["auth", "admin-user", userId],
		}),
		impersonate: defineMutation(apiContract.auth.impersonate, {
			response: envelope(ImpersonateResponseSchema),
			queryKey: ({ userId }) => ["auth", "impersonate", userId],
		}),
		stopImpersonation: defineMutation(apiContract.auth.stopImpersonation, {
			response: envelope(StopImpersonationResponseSchema),
			queryKey: () => ["auth", "stop-impersonation"],
		}),
	},

	capabilities: {
		catalog: defineQuery(apiContract.capabilities.catalog, {
			response: envelope(z.array(CapabilityDefinitionSchema)),
			queryKey: ({ scope }) => ["capabilities", "catalog", scope ?? "all"],
		}),
	},

	navigation: {
		menu: defineQuery(apiContract.navigation.menu, {
			response: envelope(DataValueSchema),
			queryKey: ({ scope }) => ["navigation", "menu", scope],
		}),
	},

	admin: {
		roles: {
			list: defineQuery(apiContract.admin.roles.list, {
				response: envelope(RoleListResponseSchema),
				queryKey: () => ["admin", "roles", "list"],
			}),
			userAssign: defineMutation(apiContract.admin.roles.userAssign, {
				response: envelope(RbacMessageResponseSchema),
				queryKey: ({ userId }) => ["admin", "roles", "user-assign", userId],
			}),
			userRemove: defineMutation(apiContract.admin.roles.userRemove, {
				response: envelope(RbacMessageResponseSchema),
				queryKey: ({ userId }) => ["admin", "roles", "user-remove", userId],
			}),
			userSync: defineMutation(apiContract.admin.roles.userSync, {
				response: envelope(RbacMessageResponseSchema),
				queryKey: ({ userId }) => ["admin", "roles", "user-sync", userId],
			}),
		},
		permissions: {
			list: defineQuery(apiContract.admin.permissions.list, {
				response: envelope(PermissionListResponseSchema),
				queryKey: () => ["admin", "permissions", "list"],
			}),
			check: defineMutation(apiContract.admin.permissions.check, {
				response: envelope(CheckPermissionResponseSchema),
				queryKey: ({ userId, action, resource }) => ["admin", "permissions", "check", userId, action, resource],
			}),
			userGrant: defineMutation(apiContract.admin.permissions.userGrant, {
				response: envelope(RbacMessageResponseSchema),
				queryKey: ({ userId }) => ["admin", "permissions", "user-grant", userId],
			}),
			userRevoke: defineMutation(apiContract.admin.permissions.userRevoke, {
				response: envelope(RbacMessageResponseSchema),
				queryKey: ({ userId }) => ["admin", "permissions", "user-revoke", userId],
			}),
			userSync: defineMutation(apiContract.admin.permissions.userSync, {
				response: envelope(RbacMessageResponseSchema),
				queryKey: ({ userId }) => ["admin", "permissions", "user-sync", userId],
			}),
		},
	},

	// ── Email template preview procedures ─────────────────────────────────────
	email: {
		previewList: defineQuery(apiContract.email.previewList, {
			response: envelope(EmailPreviewListResponseSchema),
			queryKey: () => ["email", "preview-list"],
		}),
		/** Preview detail for one template key. */
		previewDetail: defineQuery(apiContract.email.previewDetail, {
			response: envelope(EmailPreviewSchema),
			queryKey: ({ key }) => ["email", "preview-detail", key],
		}),
		/** Sends one template to the configured test address. */
		previewSend: defineMutation(apiContract.email.previewSend, {
			response: envelope(EmailSendResultSchema),
			queryKey: ({ key }) => ["email", "preview-send", key],
		}),
		logList: defineQuery(apiContract.email.logList, {
			response: envelope(EmailLogListResponseSchema),
			queryKey: ({ limit }) => ["email", "log-list", limit],
		}),
	},

	geo: {
		stats: defineQuery(apiContract.geo.stats, {
			response: envelope(z.object({ regions: z.number(), subregions: z.number(), countries: z.number(), states: z.number(), cities: z.number() }).strict()),
			queryKey: () => ["geo", "stats"],
		}),
		countries: defineQuery(apiContract.geo.countries, {
			response: envelope(z.array(CountrySchema), ApiPaginatedMetaSchema),
			queryKey: ({ page, limit, search }) => ["geo", "countries", page, limit, search],
		}),
		states: defineQuery(apiContract.geo.states, {
			response: envelope(z.array(StateSchema), ApiPaginatedMetaSchema),
			queryKey: ({ page, limit, search, countryCode }) => ["geo", "states", page, limit, search, countryCode],
		}),
		cities: defineQuery(apiContract.geo.cities, {
			response: envelope(z.array(CitySchema), ApiPaginatedMetaSchema),
			queryKey: ({ page, limit, search, countryCode }) => ["geo", "cities", page, limit, search, countryCode],
		}),
	},

	rewards: {
		list: defineQuery(apiContract.rewards.list, {
			response: envelope(z.array(RewardResponseSchema), ApiPaginatedMetaSchema),
			queryKey: ({ page, limit, search, category, city }) => ["rewards", "list", page, limit, search, category, city],
		}),
		detail: defineQuery(apiContract.rewards.detail, {
			response: envelope(RewardResponseSchema),
			queryKey: ({ rewardId }) => ["rewards", "detail", rewardId],
		}),
	},
	legal: {
		accept: defineMutation(apiContract.legal.accept, {
			response: envelope(OkResponseSchema),
			queryKey: ({ termsVersion, privacyVersion }) => ["legal", "accept", termsVersion, privacyVersion],
		}),
	},
	claims: {
		otp: defineMutation(apiContract.claims.otp, {
			response: envelope(OkResponseSchema),
			queryKey: ({ rewardId, phone }) => ["claims", "otp", rewardId, phone],
		}),
		create: defineMutation(apiContract.claims.create, {
			response: envelope(RewardClaimCreatedResponseSchema),
			queryKey: ({ rewardId }) => ["claims", "create", rewardId],
		}),
		list: defineQuery(apiContract.claims.list, {
			response: envelope(z.array(RewardClaimResponseSchema), ApiPaginatedMetaSchema),
			queryKey: ({ page, limit, status }) => ["claims", "list", page, limit, status],
		}),
		analytics: defineQuery(apiContract.claims.analytics, {
			response: envelope(UserRewardsAnalyticsResponseSchema),
			queryKey: ({ from, to }) => ["claims", "analytics", from, to],
		}),
		qr: defineQuery(apiContract.claims.qr, {
			response: envelope(RewardClaimQrResponseSchema),
			queryKey: ({ claimId }) => ["claims", "qr", claimId],
		}),
	},
	rewardNotifications: {
		list: defineQuery(apiContract.rewardNotifications.list, {
			response: envelope(RewardNotificationListResponseSchema),
			queryKey: ({ page, limit, unreadOnly }) => ["reward-notifications", "list", page, limit, unreadOnly],
		}),
		read: defineMutation(apiContract.rewardNotifications.read, {
			response: envelope(OkResponseSchema),
			queryKey: () => ["reward-notifications", "read"],
		}),
	},
	merchant: {
		me: defineQuery(apiContract.merchant.me, {
			response: envelope(z.array(MerchantMembershipResponseSchema)),
			queryKey: () => ["merchant", "me"],
		}),
		rewards: {
			list: defineQuery(apiContract.merchant.rewards.list, {
				response: envelope(z.array(RewardResponseSchema)),
				queryKey: () => ["merchant", "rewards", "list"],
			}),
			create: defineMutation(apiContract.merchant.rewards.create, {
				response: envelope(RewardResponseSchema),
				queryKey: ({ title }) => ["merchant", "rewards", "create", title],
			}),
			update: defineMutation(apiContract.merchant.rewards.update, {
				response: envelope(RewardResponseSchema),
				queryKey: ({ rewardId }) => ["merchant", "rewards", "update", rewardId],
			}),
			publish: defineMutation(apiContract.merchant.rewards.publish, {
				response: envelope(RewardResponseSchema),
				queryKey: ({ rewardId }) => ["merchant", "rewards", "publish", rewardId],
			}),
		},
		apiKeys: {
			list: defineQuery(apiContract.merchant.apiKeys.list, {
				response: envelope(z.array(MerchantApiKeySummarySchema)),
				queryKey: () => ["merchant", "api-keys", "list"],
			}),
			create: defineMutation(apiContract.merchant.apiKeys.create, {
				response: envelope(MerchantApiKeyCreatedSchema),
				queryKey: ({ name }) => ["merchant", "api-keys", "create", name],
			}),
			revoke: defineMutation(apiContract.merchant.apiKeys.revoke, {
				response: envelope(OkResponseSchema),
				queryKey: ({ keyId }) => ["merchant", "api-keys", "revoke", keyId],
			}),
		},
		redemptions: defineQuery(apiContract.merchant.redemptions, {
			response: envelope(z.array(MerchantRedemptionListItemSchema), ApiPaginatedMetaSchema),
			queryKey: ({ page, limit }) => ["merchant", "redemptions", page, limit],
		}),
		analytics: defineQuery(apiContract.merchant.analytics, {
			response: envelope(MerchantAnalyticsResponseSchema),
			queryKey: ({ from, to }) => ["merchant", "analytics", from, to],
		}),
	},

	rewardsAdmin: {
		pendingRewards: defineQuery(apiContract.rewardsAdmin.pendingRewards, {
			response: envelope(z.array(RewardResponseSchema)),
			queryKey: () => ["rewards-admin", "pending"],
		}),
		listMerchants: defineQuery(apiContract.rewardsAdmin.listMerchants, {
			response: envelope(z.array(MerchantOrgResponseSchema), ApiPaginatedMetaSchema),
			queryKey: ({ page, limit, search, city, kybStatus, status }) => ["rewards-admin", "merchants", page, limit, search, city, kybStatus, status],
		}),
		createInvite: defineMutation(apiContract.rewardsAdmin.createInvite, {
			response: envelope(AdminMerchantInviteCreatedResponseSchema),
			queryKey: ({ email }) => ["rewards-admin", "invite", email],
		}),
		previewInviteEmail: defineMutation(apiContract.rewardsAdmin.previewInviteEmail, {
			response: envelope(EmailPreviewSchema),
			queryKey: ({ email, businessName, city }) => ["rewards-admin", "invite-preview", email, businessName, city],
		}),
		approveReward: defineMutation(apiContract.rewardsAdmin.approveReward, {
			response: envelope(RewardResponseSchema),
			queryKey: ({ rewardId }) => ["rewards-admin", "approve", rewardId],
		}),
		rejectReward: defineMutation(apiContract.rewardsAdmin.rejectReward, {
			response: envelope(RewardResponseSchema),
			queryKey: ({ rewardId }) => ["rewards-admin", "reject", rewardId],
		}),
		updateKyb: defineMutation(apiContract.rewardsAdmin.updateKyb, {
			response: envelope(z.object({ ok: z.literal(true) }).strict()),
			queryKey: ({ merchantOrgId }) => ["rewards-admin", "kyb", merchantOrgId],
		}),
		listMerchantRoleCapabilities: defineQuery(apiContract.rewardsAdmin.listMerchantRoleCapabilities, {
			response: envelope(z.array(MerchantRoleCapabilityGrantSchema)),
			queryKey: () => ["rewards-admin", "merchant-role-capabilities"],
		}),
		syncMerchantRoleCapabilities: defineMutation(apiContract.rewardsAdmin.syncMerchantRoleCapabilities, {
			response: envelope(MerchantRoleCapabilityGrantSchema),
			queryKey: ({ role }) => ["rewards-admin", "merchant-role-capabilities", role],
		}),
		restoreMerchantRoleCapabilities: defineMutation(apiContract.rewardsAdmin.restoreMerchantRoleCapabilities, {
			response: envelope(MerchantRoleCapabilityGrantSchema),
			queryKey: ({ role }) => ["rewards-admin", "merchant-role-capabilities", role, "restore"],
		}),
	},
	// NOTE: `as const` is required here — it preserves literal method/path types
	// so that `typeof apiRouter` can be used to derive the full client + server
	// type system. Without it, TypeScript widens all strings to `string`.
} as const;

/** The full router tree — used to derive the client router + server caller types. */
export type ApiRouter = typeof apiRouter;
