// ============================================
// contracts/index.ts - The shared API contract
// ============================================
// The single source of truth for every route the client router (`endpoints.ts`
// in @workspace/client) and the NestJS API agree on: HTTP method, path
// template, the ONE zod input schema both sides use, and the response
// contract (ADR 022) both sides enforce.
//
// - The client router derives its defs from `apiContract` (path/method/input/
//   response come from here; the client only adds react-query key concerns)
//   and parses every response body with `response.envelope`.
// - The API validates at the HTTP boundary with the SAME input schemas
//   (`@ZodBody(apiContract.auth.login.input)`) and decorates each handler with
//   the SAME response schema (`@ZodResponse(…)` / `@ZodPaginatedResponse(…)`);
//   `apps/api/test/openapi-document.e2e-spec.ts` fails when a leaf and its
//   handler disagree, so neither half can drift.
//
// Inputs are JSON-only (`SerializableInput`), mirroring the client pipeline's
// constraints — no erasure, no casts, full autocomplete on both sides.

import { z, type ZodType } from "zod";

import { apiRoutes } from "../api-routes";
import {
	ForgotPasswordSchema,
	LoginSchema,
	ResendVerificationSchema,
	ResetPasswordSchema,
	SignupSchema,
	VerifyEmailSchema,
	ForgotPasswordResponseSchema,
	ImpersonateResponseSchema,
	LoginClientResponseSchema,
	LogoutResponseSchema,
	RefreshResponseMessageSchema,
	ResendVerificationResponseSchema,
	ResetPasswordResponseSchema,
	SignupResponseSchema,
	StopImpersonationResponseSchema,
	VerifyEmailResponseSchema,
} from "../schemas/auth/auth";
import { ChangePasswordSchema, ChangePasswordResponseSchema } from "../schemas/auth/change-password";
import {
	AdminMfaRecoveryListQuerySchema,
	AdminReviewMfaRecoverySchema,
	InitiateMfaRecoverySchema,
	AdminMfaRecoveryRequestSchema,
	MfaRecoveryStatusResponseSchema,
} from "../schemas/auth/mfa-recovery";
import { ValidateResetTokenSchema, VerifyLoginSchema, ValidateResetTokenResponseSchema } from "../schemas/auth/login-verification";
import {
	EnableTwoFactorSchema,
	LoginTwoFactorSchema,
	RotateTwoFactorSchema,
	VerifyBackupCodeLoginSchema,
	VerifyBackupCodeSchema,
	BackupCodesRemainingResponseSchema,
	TwoFactorMessageResponseSchema,
	TwoFactorSetupResponseSchema,
	VerifyBackupCodeResponseSchema,
} from "../schemas/auth/two-factor";
import { AdminUserListQuerySchema, AdminUserDetailSchema, SessionPermissionsResponseSchema, UserResponseSchema } from "../schemas/auth/user";
import { UuidParamSchema } from "../schemas/domain/platform/param-schemas";
import { EmailLogListQuerySchema, EmailLogEntrySchema, EmailPreviewListResponseSchema, EmailPreviewSchema, EmailSendResultSchema } from "../schemas/email/email";
import { CapabilityCatalogQuerySchema, CapabilityCatalogResponseSchema } from "../schemas/domain/rbac/capabilities";
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
} from "../schemas/domain/platform/geo";
import {
	AdminCreateOrganizationInviteSchema,
	AdminLocationRequestListQuerySchema,
	AdminOrganizationLocationCreateSchema,
	AdminOrganizationLocationReviewPathInputSchema,
	AdminOrganizationLocationReviewSchema,
	OrganizationAccessRequestCreateSchema,
	OrganizationLocationCreateSchema,
	OrganizationLocationIdParamSchema,
	OrganizationLocationUpdateSchema,
	OrganizationMemberInviteIdParamSchema,
	OrganizationMemberInviteSchema,
	OrganizationSlugParamSchema,
	OrganizationTeamInviteRegisterAcceptSchema,
	OrganizationTeamInviteTokenSchema,
	AdminLocationRequestResponseSchema,
	AdminOrganizationInviteCreatedResponseSchema,
	OrganizationAccessRequestResponseSchema,
	OrganizationContextResponseSchema,
	OrganizationLocationResponseSchema,
	OrganizationMemberInviteCreatedResponseSchema,
	OrganizationMemberInviteListResponseSchema,
	OrganizationMemberRosterListResponseSchema,
	OrganizationTeamInviteAcceptResponseSchema,
	OrganizationTeamInvitePreviewSchema,
} from "../schemas/domain/organization/organization";
import {
	AcceptRewardLegalSchema,
	AdminCreateMerchantInviteSchema,
	AdminKybUpdatePathInputSchema,
	AdminMerchantIdParamSchema,
	AdminMerchantListQuerySchema,
	AdminRejectRewardPathInputSchema,
	CreateRewardClaimSchema,
	MerchantApiKeyListQuerySchema,
	MerchantCreateApiKeySchema,
	MerchantCreateRewardSchema,
	MerchantRewardListQuerySchema,
	MerchantKybSubmissionFieldsSchema,
	MerchantOnboardingCompleteFieldsSchema,
	MerchantOnboardingDocumentsSubmitSchema,
	MerchantOnboardingDocumentBatchUploadCompleteSchema,
	MerchantOnboardingDocumentBatchUploadUrlSchema,
	MerchantOnboardingDocumentUploadCompleteSchema,
	MerchantOnboardingDocumentUploadUrlSchema,
	MerchantOnboardingValidateTokenSchema,
	MerchantRedemptionListQuerySchema,
	MerchantUpdateRewardPathInputSchema,
	RedemptionCheckoutSchema,
	RedemptionConfirmSchema,
	RedemptionValidateSchema,
	RequestClaimOtpSchema,
	RewardClaimListQuerySchema,
	RewardListQuerySchema,
	RewardNotificationListQuerySchema,
	MarkRewardNotificationsReadSchema,
} from "../schemas/domain/rewards/rewards";
import {
	AdminSalesAnalyticsQuerySchema,
	AdminSalesAnalyticsResponseSchema,
	MerchantAnalyticsResponseSchema,
	RewardsAnalyticsQuerySchema,
	UserRewardsAnalyticsResponseSchema,
} from "../schemas/domain/rewards/analytics";
import { AssignPermissionToUserSchema, AssignRoleToUserSchema, CheckPermissionSchema, SyncUserPermissionsSchema, SyncUserRolesSchema } from "../schemas/domain/rbac/rbac";
import {
	BulkCreateSampleCategorySchema,
	CreateSampleCategorySchema,
	SampleCategoryIdParamSchema,
	SampleCategoryListQuerySchema,
	UpdateSampleCategorySchema,
	BulkCreateSampleCategoryResponseSchema,
	SampleCategorySchema,
} from "../schemas/domain/catalog/sample-category";
import {
	BulkCreateProductSchema,
	CreateProductSchema,
	ProductIdParamSchema,
	ProductListQuerySchema,
	UpdateProductSchema,
	BulkCreateProductResponseSchema,
	ProductSchema,
} from "../schemas/domain/catalog/product";
import { BulkDeleteIdsSchema, BulkDeleteResultSchema } from "../schemas/api/bulk-mutation";
import {
	CompleteFileUploadSchema,
	CreateFileUploadUrlSchema,
	FileDownloadDispositionSchema,
	CompleteFileUploadResponseSchema,
	CreateFileUploadUrlResponseSchema,
	FileDetailResponseSchema,
	FileDownloadResponseSchema,
} from "../schemas/domain/platform/storage";
import { DeleteSuccessDataSchema } from "../schemas/api/api-response";
import { MessageResponseSchema, OkResponseSchema, SuccessAckResponseSchema } from "../schemas/api/message";
import { SessionStatusSchema } from "../schemas/auth/session-status";
import { CitySchema } from "../schemas/domain/platform/geo-city";
import { CountrySchema } from "../schemas/domain/platform/geo-country";
import { RegionSchema } from "../schemas/domain/platform/geo-region";
import { StateSchema } from "../schemas/domain/platform/geo-state";
import { SubregionSchema } from "../schemas/domain/platform/geo-subregion";
import { CityListItemSchema, CountryListItemSchema, RegionListItemSchema, StateListItemSchema, SubregionListItemSchema } from "../schemas/domain/platform/geo-list-items";
import {
	CascadePreviewResultSchema,
	GeoAutocompleteResponseSchema,
	GeoExportResponseSchema,
	GeoImportResultSchema,
	GeoImportValidationResultSchema,
	GeoStatsSchema,
} from "../schemas/domain/platform/geo-tools";
import { RbacMessageResponseSchema } from "../schemas/domain/rbac/rbac-inspection";
import { CheckPermissionResponseSchema, PermissionListResponseSchema } from "../schemas/domain/rbac/rbac-permissions";
import { RoleListResponseSchema } from "../schemas/domain/rbac/rbac-roles";
import {
	AdminMerchantDetailResponseSchema,
	AdminMerchantInviteCreatedResponseSchema,
	MerchantApiKeyCreatedSchema,
	MerchantApiKeySummarySchema,
	MerchantCreateTerminalSchema,
	MerchantTerminalListQuerySchema,
	MerchantTerminalPairingSchema,
	MerchantTerminalSettingsResponseSchema,
	MerchantTerminalSettingsSchema,
	MerchantTerminalSummarySchema,
	PosPairedTerminalSchema,
	PosPairTerminalSchema,
	MerchantOrgResponseSchema,
	MerchantRedemptionListItemSchema,
	OrganizationRewardMembershipListResponseSchema,
	RedemptionCheckoutResponseSchema,
	RedemptionConfirmedResponseSchema,
	RedemptionPreviewResponseSchema,
	RewardClaimCheckoutStatusSchema,
	RewardClaimCreatedResponseSchema,
	RewardClaimQrResponseSchema,
	RewardClaimResponseSchema,
	RewardNotificationListResponseSchema,
	RewardResponseListSchema,
	RewardResponseSchema,
} from "../schemas/domain/rewards/rewards-entities";
import {
	MerchantKybDocumentDownloadResponseSchema,
	MerchantKybProfileResponseSchema,
	MerchantOnboardingCompleteResponseSchema,
	MerchantOnboardingDocumentBatchUploadCompleteResponseSchema,
	MerchantOnboardingDocumentBatchUploadUrlResponseSchema,
	MerchantOnboardingInvitePreviewSchema,
} from "../schemas/domain/rewards/rewards-kyb";
import { paginatedResponse, singleResponse, type ApiResponseContract } from "./response";
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
export * from "./mutation-intent";
export { contractPathParam } from "./path-param";
export { paginatedResponse, singleResponse, type ApiResponseContract, type ApiResponseKind } from "./response";

// ── Route contract ─────────────────────────────────────────────────────────

export type RestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Who may call a contract route: anyone (`@Public()` on the API) or a signed-in session. */
export const ApiAccessSchema = z.enum(["public", "authenticated"]);
export type ApiAccess = z.output<typeof ApiAccessSchema>;

/**
 * One route of the contract: the wire method + path template + the single zod
 * input schema + the response contract. `M` keeps the literal method (so the
 * client router can tell query defs from mutation defs without any cast),
 * `Input` is constrained to JSON so the schema is a valid contract input on
 * both sides, and `Data` is the envelope's `data` type the client parses.
 *
 * `version` defaults to `API_VERSION` at the transport; a leaf can override it
 * (`version: "v2"`) so a single contract describes a v1+v2 migration without
 * forking the whole tree. `deprecatedSince`/`sunsetAt` are metadata for the
 * `Sunset` header and client-side deprecation warnings.
 *
 * `access` mirrors the API: `"public"` exactly when the route is `@Public()`
 * (no session needed — `test/openapi-document.e2e-spec.ts` holds the two
 * equal); omitted means `"authenticated"`. Server-side callers use it to fetch
 * a public route for a visitor with no session instead of skipping it.
 */
export interface ApiContractDef<Input extends SerializableInput, M extends RestMethod = RestMethod, Data extends DataValue = DataValue> {
	readonly method: M;
	readonly path: string;
	readonly input: ZodType<Input>;
	/** What the endpoint answers with (`singleResponse` / `paginatedResponse`) — ADR 022. */
	readonly response: ApiResponseContract<Data>;
	/** Who may call the route; omitted = `"authenticated"`. */
	readonly access?: ApiAccess;
	readonly version?: ApiVersion;
	readonly deprecatedSince?: string;
	readonly sunsetAt?: string;
}

/** Declares one route in the contract. */
export function defineContract<Input extends SerializableInput, M extends RestMethod, Data extends DataValue>(def: {
	readonly method: M;
	readonly path: string;
	readonly input: ZodType<Input>;
	readonly response: ApiResponseContract<Data>;
	readonly access?: ApiAccess;
	readonly version?: ApiVersion;
	readonly deprecatedSince?: string;
	readonly sunsetAt?: string;
}): ApiContractDef<Input, M, Data> {
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
		me: defineContract({ method: "GET", path: apiRoutes.auth.me, input: z.undefined(), response: singleResponse(UserResponseSchema) }),
		/** Session roles + permissions (refetch after RBAC mutations). */
		permissions: defineContract({ method: "GET", path: apiRoutes.auth.permissions, input: z.undefined(), response: singleResponse(SessionPermissionsResponseSchema) }),
		/** Basic protected endpoint — proves the access token is valid. */
		sessionStatus: defineContract({ method: "GET", path: apiRoutes.auth.sessionStatus, input: z.undefined(), response: singleResponse(SessionStatusSchema) }),
		login: defineContract({ access: "public", method: "POST", path: apiRoutes.auth.login, input: LoginSchema, response: singleResponse(LoginClientResponseSchema) }),
		/** Admin login — sends `X-Client-Type: admin` for cookie isolation. */
		adminLogin: defineContract({ access: "public", method: "POST", path: apiRoutes.auth.adminLogin, input: LoginSchema, response: singleResponse(LoginClientResponseSchema) }),
		signup: defineContract({ access: "public", method: "POST", path: apiRoutes.auth.signup, input: SignupSchema, response: singleResponse(SignupResponseSchema) }),
		refresh: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.auth.refresh,
			input: EmptyInputSchema,
			response: singleResponse(RefreshResponseMessageSchema),
		}),
		logout: defineContract({ access: "public", method: "POST", path: apiRoutes.auth.logout, input: EmptyInputSchema, response: singleResponse(LogoutResponseSchema) }),
		forgotPassword: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.auth.forgotPassword,
			input: ForgotPasswordSchema,
			response: singleResponse(ForgotPasswordResponseSchema),
		}),
		resetPassword: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.auth.resetPassword,
			input: ResetPasswordSchema,
			response: singleResponse(ResetPasswordResponseSchema),
		}),
		validateResetToken: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.auth.validateResetToken,
			input: ValidateResetTokenSchema,
			response: singleResponse(ValidateResetTokenResponseSchema),
		}),
		resendVerification: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.auth.resendVerification,
			input: ResendVerificationSchema,
			response: singleResponse(ResendVerificationResponseSchema),
		}),
		verifyEmail: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.auth.verifyEmail,
			input: VerifyEmailSchema,
			response: singleResponse(VerifyEmailResponseSchema),
		}),
		changePassword: defineContract({
			method: "POST",
			path: apiRoutes.auth.changePassword,
			input: ChangePasswordSchema,
			response: singleResponse(ChangePasswordResponseSchema),
		}),
		loginTwoFactor: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.auth.loginTwoFactor,
			input: LoginTwoFactorSchema,
			response: singleResponse(LoginClientResponseSchema),
		}),
		loginBackupCode: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.auth.loginBackupCode,
			input: VerifyBackupCodeLoginSchema,
			response: singleResponse(LoginClientResponseSchema),
		}),
		verifyLogin: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.auth.verifyLogin,
			input: VerifyLoginSchema,
			response: singleResponse(LoginClientResponseSchema),
		}),
		twoFactorSetup: defineContract({ method: "GET", path: apiRoutes.auth.twoFactorSetup, input: z.undefined(), response: singleResponse(TwoFactorSetupResponseSchema) }),
		twoFactorEnable: defineContract({
			method: "POST",
			path: apiRoutes.auth.twoFactorEnable,
			input: EnableTwoFactorSchema,
			response: singleResponse(TwoFactorMessageResponseSchema),
		}),
		twoFactorRotate: defineContract({
			method: "POST",
			path: apiRoutes.auth.twoFactorRotate,
			input: RotateTwoFactorSchema,
			response: singleResponse(TwoFactorSetupResponseSchema),
		}),
		twoFactorBackupCodesRemaining: defineContract({
			method: "GET",
			path: apiRoutes.auth.twoFactorBackupCodesRemaining,
			input: z.undefined(),
			response: singleResponse(BackupCodesRemainingResponseSchema),
		}),
		twoFactorVerifyBackupCode: defineContract({
			method: "POST",
			path: apiRoutes.auth.twoFactorVerifyBackupCode,
			input: VerifyBackupCodeSchema,
			response: singleResponse(VerifyBackupCodeResponseSchema),
		}),
		mfaRecoveryInitiate: defineContract({
			method: "POST",
			path: apiRoutes.auth.mfaRecoveryInitiate,
			input: InitiateMfaRecoverySchema,
			response: singleResponse(MfaRecoveryStatusResponseSchema),
		}),
		mfaRecoveryStatus: defineContract({
			method: "GET",
			path: apiRoutes.auth.mfaRecoveryStatus,
			input: z.undefined(),
			response: singleResponse(MfaRecoveryStatusResponseSchema),
		}),
		adminMfaRecoveryReview: defineContract({
			method: "POST",
			path: apiRoutes.auth.adminMfaRecoveryReview,
			input: AdminReviewMfaRecoverySchema,
			response: singleResponse(MfaRecoveryStatusResponseSchema),
		}),
		adminMfaRecoveryRequests: defineContract({
			method: "GET",
			path: apiRoutes.auth.adminMfaRecoveryRequests,
			input: AdminMfaRecoveryListQuerySchema,
			response: paginatedResponse(AdminMfaRecoveryRequestSchema),
		}),
		adminUsers: defineContract({ method: "GET", path: apiRoutes.auth.adminUsers, input: AdminUserListQuerySchema, response: paginatedResponse(AdminUserDetailSchema) }),
		adminUserDetail: defineContract({
			method: "GET",
			path: apiRoutes.auth.adminUserDetail.path,
			input: z.object({ userId: UuidParamSchema }).strict(),
			response: singleResponse(AdminUserDetailSchema),
		}),
		impersonate: defineContract({
			method: "POST",
			path: apiRoutes.auth.impersonate.path,
			input: z.object({ userId: UuidParamSchema }).strict(),
			response: singleResponse(ImpersonateResponseSchema),
		}),
		stopImpersonation: defineContract({
			method: "POST",
			path: apiRoutes.auth.stopImpersonation,
			input: EmptyInputSchema,
			response: singleResponse(StopImpersonationResponseSchema),
		}),
	},

	capabilities: {
		catalog: defineContract({
			method: "GET",
			path: apiRoutes.capabilities.catalog,
			input: CapabilityCatalogQuerySchema,
			response: singleResponse(CapabilityCatalogResponseSchema),
		}),
	},

	admin: {
		roles: {
			list: defineContract({ method: "GET", path: apiRoutes.admin.roles.list, input: EmptyInputSchema, response: singleResponse(RoleListResponseSchema) }),
			userAssign: defineContract({
				method: "POST",
				path: apiRoutes.admin.roles.userAssign,
				input: AssignRoleToUserSchema,
				response: singleResponse(RbacMessageResponseSchema),
			}),
			userRemove: defineContract({
				method: "POST",
				path: apiRoutes.admin.roles.userRemove,
				input: AssignRoleToUserSchema,
				response: singleResponse(RbacMessageResponseSchema),
			}),
			userSync: defineContract({ method: "POST", path: apiRoutes.admin.roles.userSync, input: SyncUserRolesSchema, response: singleResponse(RbacMessageResponseSchema) }),
		},
		permissions: {
			list: defineContract({ method: "GET", path: apiRoutes.admin.permissions.list, input: EmptyInputSchema, response: singleResponse(PermissionListResponseSchema) }),
			check: defineContract({
				method: "POST",
				path: apiRoutes.admin.permissions.check,
				input: CheckPermissionSchema,
				response: singleResponse(CheckPermissionResponseSchema),
			}),
			userGrant: defineContract({
				method: "POST",
				path: apiRoutes.admin.permissions.userGrant,
				input: AssignPermissionToUserSchema,
				response: singleResponse(RbacMessageResponseSchema),
			}),
			userRevoke: defineContract({
				method: "POST",
				path: apiRoutes.admin.permissions.userRevoke,
				input: AssignPermissionToUserSchema,
				response: singleResponse(RbacMessageResponseSchema),
			}),
			userSync: defineContract({
				method: "POST",
				path: apiRoutes.admin.permissions.userSync,
				input: SyncUserPermissionsSchema,
				response: singleResponse(RbacMessageResponseSchema),
			}),
		},
	},

	// ── Email templates & delivery logs ────────────────────────────────
	// Preview email templates (admin-only), send test emails, and
	// query the delivery log. Uses Resend for actual sending.
	email: {
		previewList: defineContract({ method: "GET", path: apiRoutes.email.previewList, input: z.undefined(), response: singleResponse(EmailPreviewListResponseSchema) }),
		/** Preview detail for one template key. */
		previewDetail: defineContract({
			method: "GET",
			path: apiRoutes.email.previewDetail.path,
			input: z.object({ key: z.string() }).strict(),
			response: singleResponse(EmailPreviewSchema),
		}),
		/** Sends one template to the configured test address. */
		previewSend: defineContract({
			method: "POST",
			path: apiRoutes.email.previewSend.path,
			input: z.object({ key: z.string() }).strict(),
			response: singleResponse(EmailSendResultSchema),
		}),
		logList: defineContract({ method: "GET", path: apiRoutes.email.logList, input: EmailLogListQuerySchema, response: paginatedResponse(EmailLogEntrySchema) }),
	},

	// ── Geo (Country / State / City) ────────────────────────────────
	geo: {
		// Stats & utility
		stats: defineContract({ method: "GET", path: apiRoutes.geo.stats, input: z.object({}).strict(), response: singleResponse(GeoStatsSchema) }),
		autocomplete: defineContract({
			method: "GET",
			path: apiRoutes.geo.autocomplete,
			input: GeoAutocompleteQuerySchema,
			response: singleResponse(GeoAutocompleteResponseSchema),
		}),
		importData: defineContract({ method: "POST", path: apiRoutes.geo.import, input: GeoImportInputSchema, response: singleResponse(GeoImportResultSchema) }),
		importValidate: defineContract({
			method: "POST",
			path: apiRoutes.geo.importValidate,
			input: GeoImportValidateInputSchema,
			response: singleResponse(GeoImportValidationResultSchema),
		}),
		exportData: defineContract({ method: "GET", path: apiRoutes.geo.export, input: GeoExportQuerySchema, response: singleResponse(GeoExportResponseSchema) }),
		cascadePreview: defineContract({ method: "GET", path: apiRoutes.geo.cascadePreview, input: CascadePreviewSchema, response: singleResponse(CascadePreviewResultSchema) }),
		// Regions
		regions: defineContract({ method: "GET", path: apiRoutes.geo.regions, input: RegionListQuerySchema, response: paginatedResponse(RegionListItemSchema) }),
		regionDetail: defineContract({ method: "GET", path: apiRoutes.geo.regionDetail.path, input: GeoIdParamSchema, response: singleResponse(RegionSchema) }),
		createRegion: defineContract({ method: "POST", path: apiRoutes.geo.regions, input: CreateRegionSchema, response: singleResponse(RegionSchema) }),
		updateRegion: defineContract({ method: "PATCH", path: apiRoutes.geo.regionDetail.path, input: UpdateRegionSchema, response: singleResponse(RegionSchema) }),
		deleteRegion: defineContract({ method: "DELETE", path: apiRoutes.geo.regionDetail.path, input: GeoIdParamSchema, response: singleResponse(MessageResponseSchema) }),
		// Subregions
		subregions: defineContract({ method: "GET", path: apiRoutes.geo.subregions, input: SubregionListQuerySchema, response: paginatedResponse(SubregionListItemSchema) }),
		subregionDetail: defineContract({ method: "GET", path: apiRoutes.geo.subregionDetail.path, input: GeoIdParamSchema, response: singleResponse(SubregionSchema) }),
		createSubregion: defineContract({ method: "POST", path: apiRoutes.geo.subregions, input: CreateSubregionSchema, response: singleResponse(SubregionSchema) }),
		updateSubregion: defineContract({ method: "PATCH", path: apiRoutes.geo.subregionDetail.path, input: UpdateSubregionSchema, response: singleResponse(SubregionSchema) }),
		deleteSubregion: defineContract({ method: "DELETE", path: apiRoutes.geo.subregionDetail.path, input: GeoIdParamSchema, response: singleResponse(MessageResponseSchema) }),
		// Countries
		countries: defineContract({ method: "GET", path: apiRoutes.geo.countries, input: CountryListQuerySchema, response: paginatedResponse(CountryListItemSchema) }),
		countryDetail: defineContract({ method: "GET", path: apiRoutes.geo.countryDetail.path, input: GeoIdParamSchema, response: singleResponse(CountrySchema) }),
		createCountry: defineContract({ method: "POST", path: apiRoutes.geo.countries, input: CreateCountrySchema, response: singleResponse(CountrySchema) }),
		updateCountry: defineContract({ method: "PATCH", path: apiRoutes.geo.countryDetail.path, input: UpdateCountrySchema, response: singleResponse(CountrySchema) }),
		deleteCountry: defineContract({ method: "DELETE", path: apiRoutes.geo.countryDetail.path, input: GeoIdParamSchema, response: singleResponse(MessageResponseSchema) }),
		// States
		states: defineContract({ method: "GET", path: apiRoutes.geo.states, input: StateListQuerySchema, response: paginatedResponse(StateListItemSchema) }),
		stateDetail: defineContract({ method: "GET", path: apiRoutes.geo.stateDetail.path, input: GeoIdParamSchema, response: singleResponse(StateSchema) }),
		createState: defineContract({ method: "POST", path: apiRoutes.geo.states, input: CreateStateSchema, response: singleResponse(StateSchema) }),
		updateState: defineContract({ method: "PATCH", path: apiRoutes.geo.stateDetail.path, input: UpdateStateSchema, response: singleResponse(StateSchema) }),
		deleteState: defineContract({ method: "DELETE", path: apiRoutes.geo.stateDetail.path, input: GeoIdParamSchema, response: singleResponse(MessageResponseSchema) }),
		// Cities
		cities: defineContract({ method: "GET", path: apiRoutes.geo.cities, input: CityListQuerySchema, response: paginatedResponse(CityListItemSchema) }),
		cityDetail: defineContract({ method: "GET", path: apiRoutes.geo.cityDetail.path, input: GeoIdParamSchema, response: singleResponse(CitySchema) }),
		createCity: defineContract({ method: "POST", path: apiRoutes.geo.cities, input: CreateCitySchema, response: singleResponse(CitySchema) }),
		updateCity: defineContract({ method: "PATCH", path: apiRoutes.geo.cityDetail.path, input: UpdateCitySchema, response: singleResponse(CitySchema) }),
		deleteCity: defineContract({ method: "DELETE", path: apiRoutes.geo.cityDetail.path, input: GeoIdParamSchema, response: singleResponse(MessageResponseSchema) }),
	},

	// ── Rewards platform (Phase 1) ───────────────────────────────────
	rewards: {
		list: defineContract({ access: "public", method: "GET", path: apiRoutes.rewards.list, input: RewardListQuerySchema, response: paginatedResponse(RewardResponseSchema) }),
		detail: defineContract({
			access: "public",
			method: "GET",
			path: apiRoutes.rewards.detail.path,
			input: z.object({ rewardId: UuidParamSchema }).strict(),
			response: singleResponse(RewardResponseSchema),
		}),
	},
	legal: {
		accept: defineContract({ method: "POST", path: apiRoutes.legal.accept, input: AcceptRewardLegalSchema, response: singleResponse(OkResponseSchema) }),
		status: defineContract({ method: "GET", path: apiRoutes.legal.status, input: z.undefined(), response: singleResponse(RewardClaimCheckoutStatusSchema) }),
	},
	claims: {
		otp: defineContract({ method: "POST", path: apiRoutes.claims.otp, input: RequestClaimOtpSchema, response: singleResponse(OkResponseSchema) }),
		create: defineContract({ method: "POST", path: apiRoutes.claims.create, input: CreateRewardClaimSchema, response: singleResponse(RewardClaimCreatedResponseSchema) }),
		list: defineContract({ method: "GET", path: apiRoutes.claims.list, input: RewardClaimListQuerySchema, response: paginatedResponse(RewardClaimResponseSchema) }),
		analytics: defineContract({
			method: "GET",
			path: apiRoutes.claims.analytics,
			input: RewardsAnalyticsQuerySchema,
			response: singleResponse(UserRewardsAnalyticsResponseSchema),
		}),
		qr: defineContract({
			method: "GET",
			path: apiRoutes.claims.qr.path,
			input: z.object({ claimId: UuidParamSchema }).strict(),
			response: singleResponse(RewardClaimQrResponseSchema),
		}),
	},
	rewardNotifications: {
		list: defineContract({
			method: "GET",
			path: apiRoutes.rewardNotifications.list,
			input: RewardNotificationListQuerySchema,
			response: singleResponse(RewardNotificationListResponseSchema),
		}),
		read: defineContract({ method: "POST", path: apiRoutes.rewardNotifications.read, input: MarkRewardNotificationsReadSchema, response: singleResponse(OkResponseSchema) }),
	},
	pos: {
		pairTerminal: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.pos.pairTerminal,
			input: PosPairTerminalSchema,
			response: singleResponse(PosPairedTerminalSchema),
		}),
	},
	redemptions: {
		validate: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.redemptions.validate,
			input: RedemptionValidateSchema,
			response: singleResponse(RedemptionPreviewResponseSchema),
		}),
		confirm: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.redemptions.confirm,
			input: RedemptionConfirmSchema,
			response: singleResponse(RedemptionConfirmedResponseSchema),
		}),
		checkout: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.redemptions.checkout,
			input: RedemptionCheckoutSchema,
			response: singleResponse(RedemptionCheckoutResponseSchema),
		}),
	},
	files: {
		uploadUrl: defineContract({
			method: "POST",
			path: apiRoutes.files.uploadUrl,
			input: CreateFileUploadUrlSchema,
			response: singleResponse(CreateFileUploadUrlResponseSchema),
		}),
		complete: defineContract({
			method: "POST",
			path: apiRoutes.files.complete.path,
			input: z.intersection(z.object({ fileId: UuidParamSchema }).strict(), CompleteFileUploadSchema),
			response: singleResponse(CompleteFileUploadResponseSchema),
		}),
		detail: defineContract({
			method: "GET",
			path: apiRoutes.files.detail.path,
			input: z.object({ fileId: UuidParamSchema }).strict(),
			response: singleResponse(FileDetailResponseSchema),
		}),
		downloadUrl: defineContract({
			method: "GET",
			path: apiRoutes.files.downloadUrl.path,
			input: z.object({ fileId: UuidParamSchema }).strict(),
			response: singleResponse(FileDownloadResponseSchema),
		}),
		delete: defineContract({
			method: "DELETE",
			path: apiRoutes.files.delete.path,
			input: z.object({ fileId: UuidParamSchema }).strict(),
			response: singleResponse(DeleteSuccessDataSchema),
		}),
	},
	organizations: {
		membershipsBootstrap: defineContract({
			method: "GET",
			path: apiRoutes.organizations.membershipsBootstrap,
			input: EmptyInputSchema,
			response: singleResponse(OrganizationRewardMembershipListResponseSchema),
		}),
		context: defineContract({
			method: "GET",
			path: apiRoutes.organizations.context.path,
			input: OrganizationSlugParamSchema,
			response: singleResponse(OrganizationContextResponseSchema),
		}),
		createAccessRequest: defineContract({
			method: "POST",
			path: apiRoutes.organizations.accessRequests.path,
			input: z.intersection(OrganizationSlugParamSchema, OrganizationAccessRequestCreateSchema),
			response: singleResponse(OrganizationAccessRequestResponseSchema),
		}),
		inviteMember: defineContract({
			method: "POST",
			path: apiRoutes.organizations.inviteMember.path,
			input: z.intersection(OrganizationSlugParamSchema, OrganizationMemberInviteSchema),
			response: singleResponse(OrganizationMemberInviteCreatedResponseSchema),
		}),
		listMembers: defineContract({
			method: "GET",
			path: apiRoutes.organizations.listMembers.path,
			input: OrganizationSlugParamSchema,
			response: singleResponse(OrganizationMemberRosterListResponseSchema),
		}),
		listMemberInvites: defineContract({
			method: "GET",
			path: apiRoutes.organizations.listMemberInvites.path,
			input: OrganizationSlugParamSchema,
			response: singleResponse(OrganizationMemberInviteListResponseSchema),
		}),
		revokeMemberInvite: defineContract({
			method: "POST",
			path: apiRoutes.organizations.revokeMemberInvite.path,
			input: OrganizationMemberInviteIdParamSchema,
			response: singleResponse(MessageResponseSchema),
		}),
		validateTeamInvite: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.organizations.teamInvites.validate,
			input: OrganizationTeamInviteTokenSchema,
			response: singleResponse(OrganizationTeamInvitePreviewSchema),
		}),
		acceptTeamInvite: defineContract({
			method: "POST",
			path: apiRoutes.organizations.teamInvites.accept,
			input: OrganizationTeamInviteTokenSchema,
			response: singleResponse(OrganizationTeamInviteAcceptResponseSchema),
		}),
		registerAndAcceptTeamInvite: defineContract({
			access: "public",
			method: "POST",
			path: apiRoutes.organizations.teamInvites.registerAndAccept,
			input: OrganizationTeamInviteRegisterAcceptSchema,
			response: singleResponse(LoginClientResponseSchema),
		}),
		memberships: defineContract({
			method: "GET",
			path: apiRoutes.organizations.memberships.path,
			input: OrganizationSlugParamSchema,
			response: singleResponse(OrganizationRewardMembershipListResponseSchema),
		}),
		kyb: {
			get: defineContract({
				method: "GET",
				path: apiRoutes.organizations.kyb.path,
				input: OrganizationSlugParamSchema,
				response: singleResponse(MerchantKybProfileResponseSchema),
			}),
			submit: defineContract({
				method: "PATCH",
				path: apiRoutes.organizations.kyb.path,
				input: z.intersection(OrganizationSlugParamSchema, MerchantKybSubmissionFieldsSchema),
				response: singleResponse(MerchantKybProfileResponseSchema),
			}),
			downloadDocument: defineContract({
				method: "GET",
				path: apiRoutes.organizations.kybDocumentDownload.path,
				input: z
					.object({
						orgSlug: OrganizationSlugParamSchema.shape.orgSlug,
						documentId: UuidParamSchema,
						disposition: FileDownloadDispositionSchema.optional(),
					})
					.strict(),
				response: singleResponse(MerchantKybDocumentDownloadResponseSchema),
			}),
		},
		rewards: {
			list: defineContract({
				method: "GET",
				path: apiRoutes.organizations.rewards.list.path,
				input: z.intersection(OrganizationSlugParamSchema, MerchantRewardListQuerySchema),
				response: singleResponse(RewardResponseListSchema),
			}),
			create: defineContract({
				method: "POST",
				path: apiRoutes.organizations.rewards.create.path,
				input: z.intersection(OrganizationSlugParamSchema, MerchantCreateRewardSchema),
				response: singleResponse(RewardResponseSchema),
			}),
			update: defineContract({
				method: "PATCH",
				path: apiRoutes.organizations.rewards.update.path,
				input: MerchantUpdateRewardPathInputSchema.extend({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug }),
				response: singleResponse(RewardResponseSchema),
			}),
			publish: defineContract({
				method: "POST",
				path: apiRoutes.organizations.rewards.publish.path,
				input: z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, rewardId: UuidParamSchema }).strict(),
				response: singleResponse(RewardResponseSchema),
			}),
		},
		terminals: {
			list: defineContract({
				method: "GET",
				path: apiRoutes.organizations.terminals.list.path,
				input: z.intersection(OrganizationSlugParamSchema, MerchantTerminalListQuerySchema),
				response: paginatedResponse(MerchantTerminalSummarySchema),
			}),
			create: defineContract({
				method: "POST",
				path: apiRoutes.organizations.terminals.create.path,
				input: z.intersection(OrganizationSlugParamSchema, MerchantCreateTerminalSchema),
				response: singleResponse(MerchantTerminalPairingSchema),
			}),
			pairingCode: defineContract({
				method: "POST",
				path: apiRoutes.organizations.terminals.pairingCode.path,
				input: z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, id: UuidParamSchema }).strict(),
				response: singleResponse(MerchantTerminalPairingSchema),
			}),
			remove: defineContract({
				method: "DELETE",
				path: apiRoutes.organizations.terminals.remove.path,
				input: z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, id: UuidParamSchema }).strict(),
				response: singleResponse(OkResponseSchema),
			}),
			settings: defineContract({
				method: "GET",
				path: apiRoutes.organizations.terminals.settings.path,
				input: OrganizationSlugParamSchema,
				response: singleResponse(MerchantTerminalSettingsResponseSchema),
			}),
			updateSettings: defineContract({
				method: "PATCH",
				path: apiRoutes.organizations.terminals.settings.path,
				input: z.intersection(OrganizationSlugParamSchema, MerchantTerminalSettingsSchema),
				response: singleResponse(MerchantTerminalSettingsResponseSchema),
			}),
		},
		apiKeys: {
			list: defineContract({
				method: "GET",
				path: apiRoutes.organizations.apiKeys.list.path,
				input: z.intersection(OrganizationSlugParamSchema, MerchantApiKeyListQuerySchema),
				response: paginatedResponse(MerchantApiKeySummarySchema),
			}),
			create: defineContract({
				method: "POST",
				path: apiRoutes.organizations.apiKeys.create.path,
				input: z.intersection(OrganizationSlugParamSchema, MerchantCreateApiKeySchema),
				response: singleResponse(MerchantApiKeyCreatedSchema),
			}),
			revoke: defineContract({
				method: "POST",
				path: apiRoutes.organizations.apiKeys.revoke.path,
				input: z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, keyId: UuidParamSchema }).strict(),
				response: singleResponse(OkResponseSchema),
			}),
		},
		redemptions: defineContract({
			method: "GET",
			path: apiRoutes.organizations.redemptions.path,
			input: z.intersection(OrganizationSlugParamSchema, MerchantRedemptionListQuerySchema),
			response: paginatedResponse(MerchantRedemptionListItemSchema),
		}),
		analytics: defineContract({
			method: "GET",
			path: apiRoutes.organizations.analytics.path,
			input: z.intersection(OrganizationSlugParamSchema, RewardsAnalyticsQuerySchema),
			response: singleResponse(MerchantAnalyticsResponseSchema),
		}),
		locations: {
			create: defineContract({
				method: "POST",
				path: apiRoutes.organizations.locations.create.path,
				input: z.intersection(OrganizationSlugParamSchema, OrganizationLocationCreateSchema),
				response: singleResponse(OrganizationLocationResponseSchema),
			}),
			update: defineContract({
				method: "PATCH",
				path: apiRoutes.organizations.locations.update.path,
				input: z.intersection(OrganizationLocationIdParamSchema, OrganizationLocationUpdateSchema),
				response: singleResponse(OrganizationLocationResponseSchema),
			}),
		},
		onboarding: {
			validate: defineContract({
				access: "public",
				method: "POST",
				path: apiRoutes.organizations.onboarding.validate,
				input: MerchantOnboardingValidateTokenSchema,
				response: singleResponse(MerchantOnboardingInvitePreviewSchema),
			}),
			complete: defineContract({
				access: "public",
				method: "POST",
				path: apiRoutes.organizations.onboarding.complete,
				input: MerchantOnboardingCompleteFieldsSchema,
				response: singleResponse(MerchantOnboardingCompleteResponseSchema),
			}),
			documentUploadUrl: defineContract({
				access: "public",
				method: "POST",
				path: apiRoutes.organizations.onboarding.documentUploadUrl,
				input: MerchantOnboardingDocumentUploadUrlSchema,
				response: singleResponse(CreateFileUploadUrlResponseSchema),
			}),
			documentBatchUploadUrl: defineContract({
				access: "public",
				method: "POST",
				path: apiRoutes.organizations.onboarding.documentBatchUploadUrl,
				input: MerchantOnboardingDocumentBatchUploadUrlSchema,
				response: singleResponse(MerchantOnboardingDocumentBatchUploadUrlResponseSchema),
			}),
			documentUploadComplete: defineContract({
				access: "public",
				method: "POST",
				path: apiRoutes.organizations.onboarding.documentUploadComplete,
				input: MerchantOnboardingDocumentUploadCompleteSchema,
				response: singleResponse(CompleteFileUploadResponseSchema),
			}),
			documentBatchUploadComplete: defineContract({
				access: "public",
				method: "POST",
				path: apiRoutes.organizations.onboarding.documentBatchUploadComplete,
				input: MerchantOnboardingDocumentBatchUploadCompleteSchema,
				response: singleResponse(MerchantOnboardingDocumentBatchUploadCompleteResponseSchema),
			}),
			documentsSubmit: defineContract({
				access: "public",
				method: "POST",
				path: apiRoutes.organizations.onboarding.documentsSubmit,
				input: MerchantOnboardingDocumentsSubmitSchema,
				response: singleResponse(SuccessAckResponseSchema),
			}),
		},
	},
	adminOrganizations: {
		createInvite: defineContract({
			method: "POST",
			path: apiRoutes.adminOrganizations.invites,
			input: AdminCreateOrganizationInviteSchema,
			response: singleResponse(AdminOrganizationInviteCreatedResponseSchema),
		}),
	},
	rewardsAdmin: {
		createInvite: defineContract({
			method: "POST",
			path: apiRoutes.rewardsAdmin.invites,
			input: AdminCreateMerchantInviteSchema,
			response: singleResponse(AdminMerchantInviteCreatedResponseSchema),
		}),
		previewInviteEmail: defineContract({
			method: "POST",
			path: apiRoutes.rewardsAdmin.invitesPreviewEmail,
			input: AdminCreateMerchantInviteSchema,
			response: singleResponse(EmailPreviewSchema),
		}),
		salesAnalytics: defineContract({
			method: "GET",
			path: apiRoutes.rewardsAdmin.salesAnalytics,
			input: AdminSalesAnalyticsQuerySchema,
			response: singleResponse(AdminSalesAnalyticsResponseSchema),
		}),
		pendingRewards: defineContract({
			method: "GET",
			path: apiRoutes.rewardsAdmin.rewardsPending,
			input: EmptyInputSchema,
			response: singleResponse(RewardResponseListSchema),
		}),
		listOrganizations: defineContract({
			method: "GET",
			path: apiRoutes.rewardsAdmin.merchants,
			input: AdminMerchantListQuerySchema,
			response: paginatedResponse(MerchantOrgResponseSchema),
		}),
		getOrganization: defineContract({
			method: "GET",
			path: apiRoutes.rewardsAdmin.organizationDetail.path,
			input: AdminMerchantIdParamSchema,
			response: singleResponse(AdminMerchantDetailResponseSchema),
		}),
		downloadOrganizationDocument: defineContract({
			method: "GET",
			path: apiRoutes.rewardsAdmin.organizationKybDocumentDownload.path,
			input: z
				.object({
					organizationId: UuidParamSchema,
					documentId: UuidParamSchema,
					disposition: FileDownloadDispositionSchema.optional(),
				})
				.strict(),
			response: singleResponse(MerchantKybDocumentDownloadResponseSchema),
		}),
		approveReward: defineContract({
			method: "POST",
			path: apiRoutes.rewardsAdmin.rewardApprove.path,
			input: z.object({ rewardId: UuidParamSchema }).strict(),
			response: singleResponse(RewardResponseSchema),
		}),
		rejectReward: defineContract({
			method: "POST",
			path: apiRoutes.rewardsAdmin.rewardReject.path,
			input: AdminRejectRewardPathInputSchema,
			response: singleResponse(RewardResponseSchema),
		}),
		updateKyb: defineContract({
			method: "PATCH",
			path: apiRoutes.rewardsAdmin.organizationKyb.path,
			input: AdminKybUpdatePathInputSchema,
			response: singleResponse(OkResponseSchema),
		}),
		listLocationRequests: defineContract({
			method: "GET",
			path: apiRoutes.rewardsAdmin.locationRequests,
			input: AdminLocationRequestListQuerySchema,
			response: paginatedResponse(AdminLocationRequestResponseSchema),
		}),
		createOrganizationLocation: defineContract({
			method: "POST",
			path: apiRoutes.rewardsAdmin.organizationLocationCreate.path,
			input: z.intersection(AdminMerchantIdParamSchema, AdminOrganizationLocationCreateSchema),
			response: singleResponse(OrganizationLocationResponseSchema),
		}),
		reviewOrganizationLocation: defineContract({
			method: "PATCH",
			path: apiRoutes.rewardsAdmin.organizationLocationReview.path,
			input: z.intersection(AdminOrganizationLocationReviewPathInputSchema, AdminOrganizationLocationReviewSchema),
			response: singleResponse(OrganizationLocationResponseSchema),
		}),
	},
	sampleCategory: {
		list: defineContract({ method: "GET", path: apiRoutes.sampleCategory.list, input: SampleCategoryListQuerySchema, response: paginatedResponse(SampleCategorySchema) }),
		detail: defineContract({ method: "GET", path: apiRoutes.sampleCategory.detail.path, input: SampleCategoryIdParamSchema, response: singleResponse(SampleCategorySchema) }),
		create: defineContract({ method: "POST", path: apiRoutes.sampleCategory.create, input: CreateSampleCategorySchema, response: singleResponse(SampleCategorySchema) }),
		bulkCreate: defineContract({
			method: "POST",
			path: apiRoutes.sampleCategory.bulkCreate,
			input: BulkCreateSampleCategorySchema,
			response: singleResponse(BulkCreateSampleCategoryResponseSchema),
		}),
		bulkDelete: defineContract({ method: "POST", path: apiRoutes.sampleCategory.bulkDelete, input: BulkDeleteIdsSchema, response: singleResponse(BulkDeleteResultSchema) }),
		update: defineContract({
			method: "PATCH",
			path: apiRoutes.sampleCategory.update.path,
			input: z.intersection(SampleCategoryIdParamSchema, UpdateSampleCategorySchema),
			response: singleResponse(SampleCategorySchema),
		}),
		delete: defineContract({
			method: "DELETE",
			path: apiRoutes.sampleCategory.delete.path,
			input: SampleCategoryIdParamSchema,
			response: singleResponse(DeleteSuccessDataSchema),
		}),
		restore: defineContract({
			method: "POST",
			path: apiRoutes.sampleCategory.restore.path,
			input: SampleCategoryIdParamSchema,
			response: singleResponse(SampleCategorySchema),
		}),
	},
	product: {
		list: defineContract({ method: "GET", path: apiRoutes.product.list, input: ProductListQuerySchema, response: paginatedResponse(ProductSchema) }),
		detail: defineContract({ method: "GET", path: apiRoutes.product.detail.path, input: ProductIdParamSchema, response: singleResponse(ProductSchema) }),
		create: defineContract({ method: "POST", path: apiRoutes.product.create, input: CreateProductSchema, response: singleResponse(ProductSchema) }),
		bulkCreate: defineContract({
			method: "POST",
			path: apiRoutes.product.bulkCreate,
			input: BulkCreateProductSchema,
			response: singleResponse(BulkCreateProductResponseSchema),
		}),
		bulkDelete: defineContract({ method: "POST", path: apiRoutes.product.bulkDelete, input: BulkDeleteIdsSchema, response: singleResponse(BulkDeleteResultSchema) }),
		update: defineContract({
			method: "PATCH",
			path: apiRoutes.product.update.path,
			input: z.intersection(ProductIdParamSchema, UpdateProductSchema),
			response: singleResponse(ProductSchema),
		}),
		delete: defineContract({ method: "DELETE", path: apiRoutes.product.delete.path, input: ProductIdParamSchema, response: singleResponse(DeleteSuccessDataSchema) }),
		restore: defineContract({ method: "POST", path: apiRoutes.product.restore.path, input: ProductIdParamSchema, response: singleResponse(ProductSchema) }),
	},
};

/** The full contract tree — used to derive the client router + API pipes. */
export type ApiContract = typeof apiContract;
