// ============================================
// contracts/index.ts - The shared API contract
// ============================================
// The single source of truth for every route the client router (`endpoints.ts`
// in @workspace/client) and the NestJS API agree on: HTTP method, path
// template, and the ONE zod input schema both sides use.
//
// - The client router derives its defs from `apiContract` (path/method/input
//   come from here; the client only adds react-query response/key concerns).
// - The API validates at the HTTP boundary with the SAME schemas
//   (`ZodValidationPipe(apiContract.auth.me.input)`), so the
//   validation contract can never drift between the two sides.
//
// Inputs are JSON-only (`SerializableInput`), mirroring the client pipeline's
// constraints — no erasure, no casts, full autocomplete on both sides.

import { z, type ZodType } from "zod";

import { apiRoutes } from "../api-routes";
import { ForgotPasswordSchema, LoginSchema, ResendVerificationSchema, ResetPasswordSchema, SignupSchema } from "../schemas/auth/auth";
import { AdminUserListQuerySchema } from "../schemas/auth/user";
import { UuidParamSchema, VerifyEmailTokenParamSchema } from "../schemas/domain/param-schemas";
import { EmailLogListQuerySchema } from "../schemas/email/email";
import { CapabilityCatalogQuerySchema, CapabilityDefinitionSchema, CapabilityMenuQuerySchema, CapabilityMenuResponseSchema } from "../schemas/domain/capabilities";
import {
	CityListQuerySchema,
	CountryListQuerySchema,
	CreateCitySchema,
	CreateCountrySchema,
	CreateRegionSchema,
	CreateStateSchema,
	CreateSubregionSchema,
	GeoAutocompleteQuerySchema,
	GeoExportQuerySchema,
	GeoIdParamSchema,
	GeoImportInputSchema,
	GeoImportValidateInputSchema,
	CascadePreviewSchema,
	RegionListQuerySchema,
	StateListQuerySchema,
	SubregionListQuerySchema,
	UpdateCitySchema,
	UpdateCountrySchema,
	UpdateRegionSchema,
	UpdateStateSchema,
	UpdateSubregionSchema,
} from "../schemas/domain/geo";
import {
	AcceptRewardLegalSchema,
	AdminCreateMerchantInviteSchema,
	AdminKybUpdatePathInputSchema,
	AdminKybUpdateSchema,
	AdminMerchantListQuerySchema,
	AdminRejectRewardPathInputSchema,
	AdminRejectRewardSchema,
	CreateRewardClaimSchema,
	MerchantCreateApiKeySchema,
	MerchantCreateRewardSchema,
	MerchantRedemptionListQuerySchema,
	MerchantUpdateRewardSchema,
	MerchantUpdateRewardPathInputSchema,
	RedemptionConfirmSchema,
	RedemptionValidateSchema,
	RequestClaimOtpSchema,
	RewardClaimListQuerySchema,
	RewardListQuerySchema,
	RewardNotificationListQuerySchema,
	MarkRewardNotificationsReadSchema,
} from "../schemas/domain/rewards";
import { RewardsAnalyticsQuerySchema } from "../schemas/domain/rewards-analytics";
import {
	MerchantRoleCapabilityGrantSchema,
	MerchantRoleCapabilitiesPathInputSchema,
	SyncMerchantRoleCapabilitiesInputSchema,
} from "../schemas/domain/merchant-role-capabilities";
import { AssignPermissionToUserSchema, AssignRoleToUserSchema, CheckPermissionSchema, SyncUserPermissionsSchema, SyncUserRolesSchema } from "../schemas/domain/rbac";
import type { ApiVersion } from "./versioning";

// ── JSON-safe value types (shared by the contract and the client pipeline) ─
// Canonical definitions live in `schemas/api/common.ts` to avoid duplicate
// exports. Re-exported here so consumers importing from `@workspace/shared`
// get them from either path.
import type { DataPrimitive, DataValue } from "../schemas/api/common";
export type { DataPrimitive, DataValue };

/**
 * Every procedure input is either a plain JSON object (path params + query
 * keys / body fields) or `undefined` (no-input procedures like `auth.me`).
 */
export type SerializableInput = Readonly<Record<string, DataValue | undefined>> | undefined;

// ── API versioning ─────────────────────────────────────────────────────────
// The version constants (`API_VERSION`, `apiPath`, `apiDocsPath`, …) live in
// `./versioning` — a dependency-free module — so schemas can import them
// Re-exported here for the public `@workspace/shared`
// surface; anything that only needs the constants can import `./versioning`.
export * from "./versioning";
export { contractPathParam } from "./path-param";

// ── Route contract ─────────────────────────────────────────────────────────

export type RestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * One route of the contract: the wire method + path template + the single zod
 * input schema. `M` keeps the literal method (so the client router can tell
 * query defs from mutation defs without any cast), and `Input` is constrained
 * to JSON so the schema is a valid contract input on both sides.
 *
 * `version` defaults to `API_VERSION` at the transport; a leaf can override it
 * (`version: "v2"`) so a single contract describes a v1+v2 migration without
 * forking the whole tree. `deprecatedSince`/`sunsetAt` are metadata for the
 * `Sunset` header and client-side deprecation warnings.
 */
export interface ApiContractDef<Input extends SerializableInput, M extends RestMethod = RestMethod> {
	readonly method: M;
	readonly path: string;
	readonly input: ZodType<Input>;
	readonly version?: ApiVersion;
	readonly deprecatedSince?: string;
	readonly sunsetAt?: string;
}

/** Declares one route in the contract. */
export function defineContract<Input extends SerializableInput, M extends RestMethod>(def: {
	readonly method: M;
	readonly path: string;
	readonly input: ZodType<Input>;
	readonly version?: ApiVersion;
	readonly deprecatedSince?: string;
	readonly sunsetAt?: string;
}): ApiContractDef<Input, M> {
	return def;
}

/**
 * Convenience: extract the `path` string from a `RouteDef` (static or
 * parameterized) so contracts can reference `apiRoutes` directly.
 */
export type RoutePathOf<T> = T extends { path: string } ? T["path"] : T;

// ── Local helpers ──────────────────────────────────────────────────────────

/** No-input body (refresh/logout send an empty `{}`). */
const EmptyInputSchema = z.object({}).strict();

// ── The contract ───────────────────────────────────────────────────────────
// Groups mirror the client router (auth / email / geo).
// Every leaf is the exact method + path + input the client sends on the wire.
//
// To add a new feature: see docs/ADDING-A-FEATURE.md
//
// NOTE: the version manifest (`GET /version`) is deliberately NOT a
// contract leaf — it is UNVERSIONED (the thing clients use to FIND the
// current version must never move when a major bumps). The client transport
// fetches `${API_BASE_URL}/version` directly and parses it with
// `ApiVersionManifestSchema` from @workspace/shared.

export const apiContract = {
	// ── Authentication & user management ───────────────────────────────
	// Login, signup, token refresh, password reset, email verification,
	// and admin user listing. The admin panel and web app share these.
	auth: {
		/** "Who am I?" — profile without permissions. */
		me: defineContract({ method: "GET", path: apiRoutes.auth.me, input: z.undefined() }),
		/** Session roles + permissions (refetch after RBAC mutations). */
		permissions: defineContract({ method: "GET", path: apiRoutes.auth.permissions, input: z.undefined() }),
		/** Basic protected endpoint — proves the access token is valid. */
		sessionStatus: defineContract({ method: "GET", path: apiRoutes.auth.sessionStatus, input: z.undefined() }),
		login: defineContract({ method: "POST", path: apiRoutes.auth.login, input: LoginSchema }),
		/** Admin login — sends `X-Client-Type: admin` for cookie isolation. */
		adminLogin: defineContract({ method: "POST", path: apiRoutes.auth.adminLogin, input: LoginSchema }),
		signup: defineContract({ method: "POST", path: apiRoutes.auth.signup, input: SignupSchema }),
		refresh: defineContract({ method: "POST", path: apiRoutes.auth.refresh, input: EmptyInputSchema }),
		logout: defineContract({ method: "POST", path: apiRoutes.auth.logout, input: EmptyInputSchema }),
		forgotPassword: defineContract({ method: "POST", path: apiRoutes.auth.forgotPassword, input: ForgotPasswordSchema }),
		resetPassword: defineContract({ method: "POST", path: apiRoutes.auth.resetPassword, input: ResetPasswordSchema }),
		resendVerification: defineContract({ method: "POST", path: apiRoutes.auth.resendVerification, input: ResendVerificationSchema }),
		verifyEmail: defineContract({ method: "POST", path: apiRoutes.auth.verifyEmail.path, input: z.object({ token: VerifyEmailTokenParamSchema }).strict() }),
		adminUsers: defineContract({ method: "GET", path: apiRoutes.auth.adminUsers, input: AdminUserListQuerySchema }),
		adminUserDetail: defineContract({
			method: "GET",
			path: apiRoutes.auth.adminUserDetail.path,
			input: z.object({ userId: UuidParamSchema }).strict(),
		}),
		impersonate: defineContract({
			method: "POST",
			path: apiRoutes.auth.impersonate.path,
			input: z.object({ userId: UuidParamSchema }).strict(),
		}),
		stopImpersonation: defineContract({ method: "POST", path: apiRoutes.auth.stopImpersonation, input: EmptyInputSchema }),
	},

	capabilities: {
		catalog: defineContract({ method: "GET", path: apiRoutes.capabilities.catalog, input: CapabilityCatalogQuerySchema }),
	},

	navigation: {
		menu: defineContract({ method: "GET", path: apiRoutes.navigation.menu, input: CapabilityMenuQuerySchema }),
	},

	admin: {
		roles: {
			list: defineContract({ method: "GET", path: apiRoutes.admin.roles.list, input: EmptyInputSchema }),
			userAssign: defineContract({ method: "POST", path: apiRoutes.admin.roles.userAssign, input: AssignRoleToUserSchema }),
			userRemove: defineContract({ method: "POST", path: apiRoutes.admin.roles.userRemove, input: AssignRoleToUserSchema }),
			userSync: defineContract({ method: "POST", path: apiRoutes.admin.roles.userSync, input: SyncUserRolesSchema }),
		},
		permissions: {
			list: defineContract({ method: "GET", path: apiRoutes.admin.permissions.list, input: EmptyInputSchema }),
			check: defineContract({ method: "POST", path: apiRoutes.admin.permissions.check, input: CheckPermissionSchema }),
			userGrant: defineContract({ method: "POST", path: apiRoutes.admin.permissions.userGrant, input: AssignPermissionToUserSchema }),
			userRevoke: defineContract({ method: "POST", path: apiRoutes.admin.permissions.userRevoke, input: AssignPermissionToUserSchema }),
			userSync: defineContract({ method: "POST", path: apiRoutes.admin.permissions.userSync, input: SyncUserPermissionsSchema }),
		},
	},

	// ── Email templates & delivery logs ────────────────────────────────
	// Preview email templates (admin-only), send test emails, and
	// query the delivery log. Uses Resend for actual sending.
	email: {
		previewList: defineContract({ method: "GET", path: apiRoutes.email.previewList, input: z.undefined() }),
		/** Preview detail for one template key. */
		previewDetail: defineContract({ method: "GET", path: apiRoutes.email.previewDetail.path, input: z.object({ key: z.string() }).strict() }),
		/** Sends one template to the configured test address. */
		previewSend: defineContract({ method: "POST", path: apiRoutes.email.previewSend.path, input: z.object({ key: z.string() }).strict() }),
		logList: defineContract({ method: "GET", path: apiRoutes.email.logList, input: EmailLogListQuerySchema }),
	},

	// ── Geo (Country / State / City) ────────────────────────────────
	geo: {
		// Stats & utility
		stats: defineContract({ method: "GET", path: apiRoutes.geo.stats, input: z.object({}).strict() }),
		autocomplete: defineContract({ method: "GET", path: apiRoutes.geo.autocomplete, input: GeoAutocompleteQuerySchema }),
		importData: defineContract({ method: "POST", path: apiRoutes.geo.import, input: GeoImportInputSchema }),
		importValidate: defineContract({ method: "POST", path: apiRoutes.geo.importValidate, input: GeoImportValidateInputSchema }),
		exportData: defineContract({ method: "GET", path: apiRoutes.geo.export, input: GeoExportQuerySchema }),
		cascadePreview: defineContract({ method: "GET", path: apiRoutes.geo.cascadePreview, input: CascadePreviewSchema }),
		// Regions
		regions: defineContract({ method: "GET", path: apiRoutes.geo.regions, input: RegionListQuerySchema }),
		regionDetail: defineContract({ method: "GET", path: apiRoutes.geo.regionDetail.path, input: GeoIdParamSchema }),
		createRegion: defineContract({ method: "POST", path: apiRoutes.geo.regions, input: CreateRegionSchema }),
		updateRegion: defineContract({ method: "PATCH", path: apiRoutes.geo.regionDetail.path, input: UpdateRegionSchema }),
		deleteRegion: defineContract({ method: "DELETE", path: apiRoutes.geo.regionDetail.path, input: GeoIdParamSchema }),
		// Subregions
		subregions: defineContract({ method: "GET", path: apiRoutes.geo.subregions, input: SubregionListQuerySchema }),
		subregionDetail: defineContract({ method: "GET", path: apiRoutes.geo.subregionDetail.path, input: GeoIdParamSchema }),
		createSubregion: defineContract({ method: "POST", path: apiRoutes.geo.subregions, input: CreateSubregionSchema }),
		updateSubregion: defineContract({ method: "PATCH", path: apiRoutes.geo.subregionDetail.path, input: UpdateSubregionSchema }),
		deleteSubregion: defineContract({ method: "DELETE", path: apiRoutes.geo.subregionDetail.path, input: GeoIdParamSchema }),
		// Countries
		countries: defineContract({ method: "GET", path: apiRoutes.geo.countries, input: CountryListQuerySchema }),
		countryDetail: defineContract({ method: "GET", path: apiRoutes.geo.countryDetail.path, input: GeoIdParamSchema }),
		createCountry: defineContract({ method: "POST", path: apiRoutes.geo.countries, input: CreateCountrySchema }),
		updateCountry: defineContract({ method: "PATCH", path: apiRoutes.geo.countryDetail.path, input: UpdateCountrySchema }),
		deleteCountry: defineContract({ method: "DELETE", path: apiRoutes.geo.countryDetail.path, input: GeoIdParamSchema }),
		// States
		states: defineContract({ method: "GET", path: apiRoutes.geo.states, input: StateListQuerySchema }),
		stateDetail: defineContract({ method: "GET", path: apiRoutes.geo.stateDetail.path, input: GeoIdParamSchema }),
		createState: defineContract({ method: "POST", path: apiRoutes.geo.states, input: CreateStateSchema }),
		updateState: defineContract({ method: "PATCH", path: apiRoutes.geo.stateDetail.path, input: UpdateStateSchema }),
		deleteState: defineContract({ method: "DELETE", path: apiRoutes.geo.stateDetail.path, input: GeoIdParamSchema }),
		// Cities
		cities: defineContract({ method: "GET", path: apiRoutes.geo.cities, input: CityListQuerySchema }),
		cityDetail: defineContract({ method: "GET", path: apiRoutes.geo.cityDetail.path, input: GeoIdParamSchema }),
		createCity: defineContract({ method: "POST", path: apiRoutes.geo.cities, input: CreateCitySchema }),
		updateCity: defineContract({ method: "PATCH", path: apiRoutes.geo.cityDetail.path, input: UpdateCitySchema }),
		deleteCity: defineContract({ method: "DELETE", path: apiRoutes.geo.cityDetail.path, input: GeoIdParamSchema }),
	},

	// ── Rewards platform (Phase 1) ───────────────────────────────────
	rewards: {
		list: defineContract({ method: "GET", path: apiRoutes.rewards.list, input: RewardListQuerySchema }),
		detail: defineContract({
			method: "GET",
			path: apiRoutes.rewards.detail.path,
			input: z.object({ rewardId: UuidParamSchema }).strict(),
		}),
	},
	legal: {
		accept: defineContract({ method: "POST", path: apiRoutes.legal.accept, input: AcceptRewardLegalSchema }),
	},
	claims: {
		otp: defineContract({ method: "POST", path: apiRoutes.claims.otp, input: RequestClaimOtpSchema }),
		create: defineContract({ method: "POST", path: apiRoutes.claims.create, input: CreateRewardClaimSchema }),
		list: defineContract({ method: "GET", path: apiRoutes.claims.list, input: RewardClaimListQuerySchema }),
		analytics: defineContract({ method: "GET", path: apiRoutes.claims.analytics, input: RewardsAnalyticsQuerySchema }),
		qr: defineContract({
			method: "GET",
			path: apiRoutes.claims.qr.path,
			input: z.object({ claimId: UuidParamSchema }).strict(),
		}),
	},
	rewardNotifications: {
		list: defineContract({ method: "GET", path: apiRoutes.rewardNotifications.list, input: RewardNotificationListQuerySchema }),
		read: defineContract({ method: "POST", path: apiRoutes.rewardNotifications.read, input: MarkRewardNotificationsReadSchema }),
	},
	redemptions: {
		validate: defineContract({ method: "POST", path: apiRoutes.redemptions.validate, input: RedemptionValidateSchema }),
		confirm: defineContract({ method: "POST", path: apiRoutes.redemptions.confirm, input: RedemptionConfirmSchema }),
	},
	merchant: {
		me: defineContract({ method: "GET", path: apiRoutes.merchant.me, input: EmptyInputSchema }),
		rewards: {
			list: defineContract({ method: "GET", path: apiRoutes.merchant.rewards.list, input: EmptyInputSchema }),
			create: defineContract({ method: "POST", path: apiRoutes.merchant.rewards.create, input: MerchantCreateRewardSchema }),
			update: defineContract({
				method: "PATCH",
				path: apiRoutes.merchant.rewards.update.path,
				input: MerchantUpdateRewardPathInputSchema,
			}),
			publish: defineContract({
				method: "POST",
				path: apiRoutes.merchant.rewards.publish.path,
				input: z.object({ rewardId: UuidParamSchema }).strict(),
			}),
		},
		apiKeys: {
			list: defineContract({ method: "GET", path: apiRoutes.merchant.apiKeys.list, input: EmptyInputSchema }),
			create: defineContract({ method: "POST", path: apiRoutes.merchant.apiKeys.create, input: MerchantCreateApiKeySchema }),
			revoke: defineContract({
				method: "POST",
				path: apiRoutes.merchant.apiKeys.revoke.path,
				input: z.object({ keyId: UuidParamSchema }).strict(),
			}),
		},
		redemptions: defineContract({ method: "GET", path: apiRoutes.merchant.redemptions, input: MerchantRedemptionListQuerySchema }),
		analytics: defineContract({ method: "GET", path: apiRoutes.merchant.analytics, input: RewardsAnalyticsQuerySchema }),
	},
	rewardsAdmin: {
		createInvite: defineContract({ method: "POST", path: apiRoutes.rewardsAdmin.invites, input: AdminCreateMerchantInviteSchema }),
		previewInviteEmail: defineContract({ method: "POST", path: apiRoutes.rewardsAdmin.invitesPreviewEmail, input: AdminCreateMerchantInviteSchema }),
		pendingRewards: defineContract({ method: "GET", path: apiRoutes.rewardsAdmin.rewardsPending, input: EmptyInputSchema }),
		listMerchants: defineContract({ method: "GET", path: apiRoutes.rewardsAdmin.merchants, input: AdminMerchantListQuerySchema }),
		approveReward: defineContract({
			method: "POST",
			path: apiRoutes.rewardsAdmin.rewardApprove.path,
			input: z.object({ rewardId: UuidParamSchema }).strict(),
		}),
		rejectReward: defineContract({
			method: "POST",
			path: apiRoutes.rewardsAdmin.rewardReject.path,
			input: AdminRejectRewardPathInputSchema,
		}),
		updateKyb: defineContract({
			method: "PATCH",
			path: apiRoutes.rewardsAdmin.merchantKyb.path,
			input: AdminKybUpdatePathInputSchema,
		}),
		listMerchantRoleCapabilities: defineContract({
			method: "GET",
			path: apiRoutes.rewardsAdmin.merchantRoleCapabilities,
			input: EmptyInputSchema,
		}),
		syncMerchantRoleCapabilities: defineContract({
			method: "PUT",
			path: apiRoutes.rewardsAdmin.merchantRoleCapabilitiesSync.path,
			input: SyncMerchantRoleCapabilitiesInputSchema,
		}),
		restoreMerchantRoleCapabilities: defineContract({
			method: "POST",
			path: apiRoutes.rewardsAdmin.merchantRoleCapabilitiesRestore.path,
			input: MerchantRoleCapabilitiesPathInputSchema,
		}),
	},
};

/** The full contract tree — used to derive the client router + API pipes. */
export type ApiContract = typeof apiContract;
