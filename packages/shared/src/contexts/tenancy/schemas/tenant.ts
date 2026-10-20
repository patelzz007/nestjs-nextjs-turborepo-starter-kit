import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { CanonicalEmailSchema } from "../../../schemas/api/email-address";
import { defineListQuery, listFilter } from "../../../schemas/api/list-query";
import { strongPassword } from "../../identity/schemas/password";
import { ImageSourceSchema } from "../../files/schemas/storage";
import { IanaTimeZoneSchema } from "../../reporting/schemas/analytics-time-zone";
import { KybStatusSchema, PilotCitySchema } from "./tenant-enums";

/** Tenant lifecycle states — authoritative across API, workers, billing. */
export const TenantLifecycleStateSchema = z.enum(["PROVISIONING", "ACTIVE", "RESTRICTED", "SUSPENDED", "PENDING_DELETION", "DELETED"]);

export type TenantLifecycleState = z.output<typeof TenantLifecycleStateSchema>;

export const MembershipRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "POLICY_ADMIN", "CASHIER"]);

export type MembershipRole = z.output<typeof MembershipRoleSchema>;

export const MembershipStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "PENDING"]);

export type MembershipStatus = z.output<typeof MembershipStatusSchema>;

export const LocationScopeTypeSchema = z.enum(["ALL_LOCATIONS", "SELECTED"]);

export type LocationScopeType = z.output<typeof LocationScopeTypeSchema>;

export const LocationStatusSchema = z.enum(["PENDING_APPROVAL", "ACTIVE", "REJECTED", "INACTIVE"]);

export type LocationStatus = z.output<typeof LocationStatusSchema>;

export const TenantInvitationStatusSchema = z.enum(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]);

export type TenantInvitationStatus = z.output<typeof TenantInvitationStatusSchema>;

export const TenantInvitationKindSchema = z.enum(["PLATFORM_ONBOARDING", "TEAM_MEMBER"]);

export type TenantInvitationKind = z.output<typeof TenantInvitationKindSchema>;

export const TenantAccessRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

export type TenantAccessRequestStatus = z.output<typeof TenantAccessRequestStatusSchema>;

export const AuthorizationPolicyScopeSchema = z.enum(["PLATFORM_GUARDRAIL", "PLATFORM", "TENANT"]);

export type AuthorizationPolicyScope = z.output<typeof AuthorizationPolicyScopeSchema>;

export const AuthorizationPolicyStatusSchema = z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHED", "SUPERSEDED", "ROLLED_BACK"]);

export type AuthorizationPolicyStatus = z.output<typeof AuthorizationPolicyStatusSchema>;

export const SupportAccessGrantModeSchema = z.enum(["READ_ONLY", "WRITE_ELEVATED"]);

export type SupportAccessGrantMode = z.output<typeof SupportAccessGrantModeSchema>;

export const SupportAccessGrantStatusSchema = z.enum(["PENDING_APPROVAL", "PENDING_TENANT_APPROVAL", "ACTIVE", "EXPIRED", "REVOKED", "DENIED"]);

export type SupportAccessGrantStatus = z.output<typeof SupportAccessGrantStatusSchema>;

export const TenantPlacementKindSchema = z.enum(["SHARED", "DEDICATED"]);

export type TenantPlacementKind = z.output<typeof TenantPlacementKindSchema>;

/** URL-safe tenant slug. */
export const TenantSlugSchema = z
	.string()
	.min(2)
	.max(64)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export type TenantSlug = z.output<typeof TenantSlugSchema>;

/** Slug or tenant id — accepted in `/tenants/:tenantSlug` routes for backwards-compatible deep links. */
export const TenantRouteKeySchema = z.union([TenantSlugSchema, z.uuid()]);

export type TenantRouteKey = z.output<typeof TenantRouteKeySchema>;

export const TenantIdParamSchema = z.object({
	tenantId: z.uuid(),
});

export type TenantIdParam = z.output<typeof TenantIdParamSchema>;

export const TenantSlugParamSchema = z
	.object({
		tenantSlug: TenantRouteKeySchema,
	})
	.strict();

export type TenantSlugParam = z.output<typeof TenantSlugParamSchema>;

/** Route params of `POST /tenants/:tenantSlug/access-requests/:requestId/review`. */
export const TenantAccessRequestParamSchema = TenantSlugParamSchema.extend({
	requestId: z.uuid(),
}).strict();

export type TenantAccessRequestParam = z.output<typeof TenantAccessRequestParamSchema>;

export const LocationResponseSchema = z.object({
	id: z.uuid(),
	tenantId: z.uuid(),
	name: z.string(),
	code: z.string(),
	addressText: z.string().nullable(),
	city: PilotCitySchema.nullable(),
	contactPhone: z.string().nullable(),
	status: LocationStatusSchema,
	rejectionReason: z.string().nullable(),
	isPrimary: z.boolean(),
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type LocationResponse = z.output<typeof LocationResponseSchema>;

/** Draft store row for onboarding or admin pre-provisioning. */
export const LocationDraftSchema = z
	.object({
		name: z.string().min(1).max(200),
		addressText: z.string().min(1).max(2000),
		contactPhone: z.string().min(1).max(20).optional(),
	})
	.strict();

export type LocationDraft = z.output<typeof LocationDraftSchema>;

/** Primary store draft during onboarding — contact phone is required. */
export const TenantPrimaryLocationDraftSchema = LocationDraftSchema.extend({
	contactPhone: z.string().min(5).max(20),
});

export type TenantPrimaryLocationDraft = z.output<typeof TenantPrimaryLocationDraftSchema>;

export const LocationCreateSchema = LocationDraftSchema;

export type LocationCreateInput = z.output<typeof LocationCreateSchema>;

export const LocationUpdateSchema = LocationDraftSchema;

export type LocationUpdateInput = z.output<typeof LocationUpdateSchema>;

export const LocationIdParamSchema = z
	.object({
		tenantSlug: TenantRouteKeySchema,
		locationId: z.uuid(),
	})
	.strict();

export type LocationIdParam = z.output<typeof LocationIdParamSchema>;

/** Longest closure reason a merchant can record (stored on the location, echoed in the audit row). */
export const TENANT_LOCATION_CLOSURE_REASON_MAX_LENGTH = 500;

/** Close a store for good (bankruptcy, lease ended, ...): the reason is required and kept with the closed store. */
export const LocationCloseSchema = z
	.object({
		reason: z.string().trim().min(1).max(TENANT_LOCATION_CLOSURE_REASON_MAX_LENGTH),
	})
	.strict();

export type LocationCloseInput = z.output<typeof LocationCloseSchema>;

/** What closing a store took with it (the store itself stays readable as history). */
export const LocationCloseResponseSchema = z.object({
	locationId: z.uuid(),
	storeId: z.uuid(),
	closedAt: EpochMsSchema,
	reason: z.string(),
	storeMembershipsRemoved: z.number().int().nonnegative(),
	memberScopesRemoved: z.number().int().nonnegative(),
	terminalsRemoved: z.number().int().nonnegative(),
	apiKeysRevoked: z.number().int().nonnegative(),
});

export type LocationCloseResponse = z.output<typeof LocationCloseResponseSchema>;

export const TenantMemberStoreParamSchema = z
	.object({
		tenantSlug: TenantSlugSchema,
		membershipId: z.uuid(),
		locationId: z.uuid(),
	})
	.strict();

export type TenantMemberStoreParam = z.output<typeof TenantMemberStoreParamSchema>;

/** Remove a team member from one store. A member left with no store at all is refused unless `allowNoStores` is set. */
export const TenantMemberStoreRemoveSchema = z
	.object({
		allowNoStores: z.boolean().default(false),
	})
	.strict();

export type TenantMemberStoreRemoveInput = z.output<typeof TenantMemberStoreRemoveSchema>;

export const TenantMemberStoreRemoveResponseSchema = z.object({
	membershipId: z.uuid(),
	locationId: z.uuid(),
	removedAt: EpochMsSchema,
	remainingLocationIds: z.array(z.uuid()),
});

export type TenantMemberStoreRemoveResponse = z.output<typeof TenantMemberStoreRemoveResponseSchema>;

export const AdminLocationCreateSchema = z
	.object({
		name: z.string().min(1).max(200),
		addressText: z.string().min(1).max(2000),
		contactPhone: z.string().min(1).max(20).optional(),
		city: PilotCitySchema.optional(),
		approveImmediately: z.boolean().default(true),
	})
	.strict();

export type AdminLocationCreateInput = z.output<typeof AdminLocationCreateSchema>;

export const AdminLocationReviewSchema = z
	.object({
		approve: z.boolean(),
		rejectionReason: z.string().min(1).max(2000).optional(),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (!value.approve && (value.rejectionReason === undefined || value.rejectionReason.trim().length === 0)) {
			ctx.addIssue({
				code: "custom",
				message: "Rejection reason is required when declining a store request",
				path: ["rejectionReason"],
			});
		}
	});

export type AdminLocationReviewInput = z.output<typeof AdminLocationReviewSchema>;

export const AdminLocationReviewPathInputSchema = z
	.object({
		tenantId: z.uuid(),
		locationId: z.uuid(),
	})
	.strict();

export type AdminLocationReviewPathInput = z.output<typeof AdminLocationReviewPathInputSchema>;

/** Page size the admin location-request queue has always used. */
export const ADMIN_LOCATION_REQUEST_DEFAULT_LIMIT = 50;

/** `GET /admin/location-requests` list query — oldest first (a FIFO review queue); the queue view sends `filter[status]=PENDING_APPROVAL`. */
export const adminLocationRequestListQuery = defineListQuery({
	sortable: ["createdAt", "name"],
	defaultSort: [{ field: "createdAt", direction: "asc" }],
	filter: {
		status: listFilter.enumeration(LocationStatusSchema, { eq: true, in: true }),
	},
	params: {},
	defaultLimit: ADMIN_LOCATION_REQUEST_DEFAULT_LIMIT,
});
export const AdminLocationRequestListQuerySchema = adminLocationRequestListQuery.schema;
export type AdminLocationRequestListQuery = z.output<typeof AdminLocationRequestListQuerySchema>;
export type AdminLocationRequestListSortField = (typeof adminLocationRequestListQuery.sortable)[number];

export const AdminLocationRequestResponseSchema = z.object({
	id: z.uuid(),
	tenantId: z.uuid(),
	tenantSlug: TenantSlugSchema,
	tenantDisplayName: z.string(),
	name: z.string(),
	code: z.string(),
	addressText: z.string().nullable(),
	city: PilotCitySchema.nullable(),
	contactPhone: z.string().nullable(),
	status: LocationStatusSchema,
	rejectionReason: z.string().nullable(),
	isPrimary: z.boolean(),
	requestedByUserId: z.uuid().nullable(),
	createdAt: EpochMsSchema,
});

export type AdminLocationRequestResponse = z.output<typeof AdminLocationRequestResponseSchema>;

export const MembershipResponseSchema = z.object({
	id: z.uuid(),
	tenantId: z.uuid(),
	userId: z.uuid(),
	role: MembershipRoleSchema,
	status: MembershipStatusSchema,
	displayName: z.string().nullable(),
	locationScopeType: LocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type MembershipResponse = z.output<typeof MembershipResponseSchema>;

/** Longest display name a member can choose for one tenant (`tenant_memberships.display_name` is VARCHAR(100)). */
export const TENANT_MEMBER_DISPLAY_NAME_MAX_LENGTH = 100;

/** A member's display name for one tenant: trimmed, never blank. */
export const TenantMemberDisplayNameSchema = z.string().trim().min(1).max(TENANT_MEMBER_DISPLAY_NAME_MAX_LENGTH);

/**
 * `PATCH /tenants/:tenantSlug/members/me` — the signed-in member updates their OWN
 * membership. `displayName: null` clears it (the account's full name is shown
 * instead); a blank string is rejected rather than silently stored.
 */
export const TenantOwnMembershipUpdateSchema = z
	.object({
		displayName: TenantMemberDisplayNameSchema.nullable(),
	})
	.strict();

export type TenantOwnMembershipUpdateInput = z.output<typeof TenantOwnMembershipUpdateSchema>;

export const TenantSummaryResponseSchema = z.object({
	id: z.uuid(),
	slug: TenantSlugSchema,
	displayName: z.string(),
	lifecycleState: TenantLifecycleStateSchema,
	primaryLocationId: z.uuid().nullable(),
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type TenantSummaryResponse = z.output<typeof TenantSummaryResponseSchema>;

export const TenantMerchantProfileResponseSchema = z.object({
	tenantId: z.uuid(),
	legalName: z.string().nullable(),
	/** Null until the merchant submits a business category during onboarding. */
	category: z.string().nullable(),
	city: PilotCitySchema,
	kybStatus: KybStatusSchema,
	contactEmail: z.email(),
	contactPhone: z.string().nullable(),
});

export type TenantMerchantProfileResponse = z.output<typeof TenantMerchantProfileResponseSchema>;

/**
 * A tenant's store logo: its `STORE_LOGO` file (to replace or remove it
 * through `/files`) and the public URL it is shown from.
 */
export const TenantLogoResponseSchema = z.object({
	fileId: z.uuid(),
	url: z.url({ protocol: /^https?$/ }),
	/** Its served sizes, smallest first, for `srcset` (empty for a logo uploaded before logos had renditions). */
	sources: z.array(ImageSourceSchema),
});

export type TenantLogoResponse = z.output<typeof TenantLogoResponseSchema>;

/**
 * The tenant as its own members see it in the context: the summary plus
 * the IANA zone the merchant operates in (`Tenant.timeZone`) — the zone
 * merchant analytics cut days, weeks and months in, so a screen can resolve a
 * date range in it before asking for a report — and its store logo.
 */
export const TenantContextSummaryResponseSchema = TenantSummaryResponseSchema.extend({
	timeZone: IanaTimeZoneSchema,
	/** The tenant's live store logo, or `null` (screens show a name monogram). */
	logo: TenantLogoResponseSchema.nullable(),
});

export type TenantContextSummaryResponse = z.output<typeof TenantContextSummaryResponseSchema>;

export const TenantContextResponseSchema = z.object({
	tenant: TenantContextSummaryResponseSchema,
	membership: MembershipResponseSchema,
	locations: z.array(LocationResponseSchema),
	merchantProfile: TenantMerchantProfileResponseSchema.nullable(),
	policyVersion: z.number().int().nonnegative(),
});

export type TenantContextResponse = z.output<typeof TenantContextResponseSchema>;

export const AdminCreateTenantInviteSchema = z
	.object({
		email: CanonicalEmailSchema,
		displayName: z.string().min(1).max(200),
		slug: TenantSlugSchema,
		intendedRole: MembershipRoleSchema.default("OWNER"),
		city: PilotCitySchema,
		category: z.string().min(1).max(100),
	})
	.strict();

export type AdminCreateTenantInviteInput = z.output<typeof AdminCreateTenantInviteSchema>;

export const TenantAccessRequestCreateSchema = z
	.object({
		message: z.string().max(500).optional(),
	})
	.strict();

export type TenantAccessRequestCreateInput = z.output<typeof TenantAccessRequestCreateSchema>;

export const TenantAccessRequestResponseSchema = z.object({
	id: z.uuid(),
	tenantId: z.uuid(),
	userId: z.uuid(),
	status: TenantAccessRequestStatusSchema,
	message: z.string().nullable(),
	createdAt: EpochMsSchema,
});

export type TenantAccessRequestResponse = z.output<typeof TenantAccessRequestResponseSchema>;

/**
 * Roles a team manager may grant through a team invite or an access-request
 * approval. OWNER is never grantable this way (ownership is provisioned).
 */
export const TenantTeamGrantableRoleSchema = MembershipRoleSchema.exclude(["OWNER"]);

export type TenantTeamGrantableRole = z.output<typeof TenantTeamGrantableRoleSchema>;

/** Upper bound on the store ids one membership scope may list. */
export const TENANT_SCOPE_MAX_LOCATION_IDS = 200;

/**
 * Approving an access request states the granted role and location scope
 * explicitly — nothing defaults to a permissive value. `SELECTED` needs at
 * least one (distinct) store; `ALL_LOCATIONS` takes none.
 */
const ReviewTenantAccessRequestApproveSchema = z
	.object({
		approve: z.literal(true),
		role: TenantTeamGrantableRoleSchema,
		locationScopeType: LocationScopeTypeSchema,
		locationIds: z.array(z.uuid()).max(TENANT_SCOPE_MAX_LOCATION_IDS),
	})
	.strict();

const ReviewTenantAccessRequestRejectSchema = z
	.object({
		approve: z.literal(false),
	})
	.strict();

export const ReviewTenantAccessRequestSchema = z
	.discriminatedUnion("approve", [ReviewTenantAccessRequestApproveSchema, ReviewTenantAccessRequestRejectSchema])
	.superRefine((value, ctx): void => {
		if (!value.approve) {
			return;
		}
		if (value.locationScopeType === "SELECTED" && value.locationIds.length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "Select at least one location",
				path: ["locationIds"],
			});
		}
		if (value.locationScopeType === "ALL_LOCATIONS" && value.locationIds.length > 0) {
			ctx.addIssue({
				code: "custom",
				message: "Locations can only be listed for a selected-locations scope",
				path: ["locationIds"],
			});
		}
		if (new Set(value.locationIds).size !== value.locationIds.length) {
			ctx.addIssue({
				code: "custom",
				message: "Each location may be listed only once",
				path: ["locationIds"],
			});
		}
	});

export type ReviewTenantAccessRequestInput = z.output<typeof ReviewTenantAccessRequestSchema>;

const TEAM_INVITE_ROLES: readonly MembershipRole[] = TenantTeamGrantableRoleSchema.options;

export const TenantMemberInviteFieldsSchema = z
	.object({
		email: CanonicalEmailSchema,
		role: MembershipRoleSchema,
		locationScopeType: LocationScopeTypeSchema.default("ALL_LOCATIONS"),
		locationIds: z.array(z.uuid()).default([]),
	})
	.strict();

export type TenantMemberInviteFields = z.output<typeof TenantMemberInviteFieldsSchema>;

export const TenantMemberInviteSchema = TenantMemberInviteFieldsSchema.superRefine((value, ctx): void => {
	if (!TEAM_INVITE_ROLES.includes(value.role)) {
		ctx.addIssue({
			code: "custom",
			message: "Owner role cannot be assigned via team invite",
			path: ["role"],
		});
	}

	if (value.locationScopeType === "SELECTED" && value.locationIds.length === 0) {
		ctx.addIssue({
			code: "custom",
			message: "Select at least one location",
			path: ["locationIds"],
		});
	}
});

export type TenantMemberInviteInput = z.output<typeof TenantMemberInviteSchema>;

export const TenantMemberRosterResponseSchema = z.object({
	id: z.uuid(),
	tenantId: z.uuid(),
	userId: z.uuid(),
	email: z.email(),
	fullName: z.string(),
	role: MembershipRoleSchema,
	status: MembershipStatusSchema,
	displayName: z.string().nullable(),
	locationScopeType: LocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type TenantMemberRosterResponse = z.output<typeof TenantMemberRosterResponseSchema>;

export const TenantMemberInviteResponseSchema = z.object({
	id: z.uuid(),
	tenantId: z.uuid(),
	email: z.email(),
	intendedRole: MembershipRoleSchema,
	locationScopeType: LocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
	status: TenantInvitationStatusSchema,
	invitedByUserId: z.uuid(),
	invitedByName: z.string(),
	expiresAt: EpochMsSchema,
	createdAt: EpochMsSchema,
});

export type TenantMemberInviteResponse = z.output<typeof TenantMemberInviteResponseSchema>;

export const TenantMemberInviteCreatedResponseSchema = z.object({
	inviteId: z.uuid(),
	message: z.string(),
});

export type TenantMemberInviteCreatedResponse = z.output<typeof TenantMemberInviteCreatedResponseSchema>;

export const TenantMemberInviteIdParamSchema = z
	.object({
		tenantSlug: TenantSlugSchema,
		inviteId: z.uuid(),
	})
	.strict();

export type TenantMemberInviteIdParam = z.output<typeof TenantMemberInviteIdParamSchema>;

export const TenantTeamInviteTokenSchema = z
	.object({
		token: z.string().min(16).max(256),
	})
	.strict();

export type TenantTeamInviteTokenInput = z.output<typeof TenantTeamInviteTokenSchema>;

export const TenantTeamInviteRegisterAcceptSchema = TenantTeamInviteTokenSchema.extend({
	fullName: z.string().min(2, "Full name must be at least 2 characters"),
	password: strongPassword,
}).strict();

export type TenantTeamInviteRegisterAcceptInput = z.output<typeof TenantTeamInviteRegisterAcceptSchema>;

export const TenantTeamInvitePreviewSchema = z.object({
	email: z.email(),
	tenantDisplayName: z.string(),
	tenantSlug: TenantSlugSchema,
	intendedRole: MembershipRoleSchema,
	locationScopeType: LocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
	locationLabels: z.array(
		z.object({
			id: z.uuid(),
			name: z.string(),
		}),
	),
	expiresAt: EpochMsSchema,
	hasExistingAccount: z.boolean(),
});

export type TenantTeamInvitePreview = z.output<typeof TenantTeamInvitePreviewSchema>;

export const TenantTeamInviteAcceptResponseSchema = z.object({
	tenantSlug: TenantSlugSchema,
	message: z.string(),
});

export type TenantTeamInviteAcceptResponse = z.output<typeof TenantTeamInviteAcceptResponseSchema>;

export const PolicyBuilderPayloadSchema = z
	.object({
		templateId: z.string(),
		parameters: z.record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())])),
	})
	.strict();

export type PolicyBuilderPayload = z.output<typeof PolicyBuilderPayloadSchema>;

export const AuthorizationPolicyDraftResponseSchema = z.object({
	id: z.uuid(),
	tenantId: z.uuid().nullable(),
	scope: AuthorizationPolicyScopeSchema,
	name: z.string(),
	status: AuthorizationPolicyStatusSchema,
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type AuthorizationPolicyDraftResponse = z.output<typeof AuthorizationPolicyDraftResponseSchema>;

export const SupportAccessGrantRequestSchema = z
	.object({
		tenantId: z.uuid(),
		reason: z.string().min(10).max(2000),
		ticketRef: z.string().max(120).optional(),
		mode: SupportAccessGrantModeSchema.default("READ_ONLY"),
		durationMinutes: z.number().int().min(15).max(480).default(60),
	})
	.strict();

export type SupportAccessGrantRequestInput = z.output<typeof SupportAccessGrantRequestSchema>;

export const SupportAccessGrantResponseSchema = z.object({
	id: z.uuid(),
	tenantId: z.uuid(),
	mode: SupportAccessGrantModeSchema,
	status: SupportAccessGrantStatusSchema,
	expiresAt: EpochMsSchema,
	createdAt: EpochMsSchema,
});

export type SupportAccessGrantResponse = z.output<typeof SupportAccessGrantResponseSchema>;

export const TenantDeletionRequestSchema = z
	.object({
		confirmDisplayName: z.string().min(1),
	})
	.strict();

export type TenantDeletionRequestInput = z.output<typeof TenantDeletionRequestSchema>;

export { LocationFilterSchema, type LocationFilter } from "./location-filter";

/** `GET /tenants/:tenantSlug/members` list query — the roster in the order members joined; `filter[role]` narrows it. */
export const tenantMemberListQuery = defineListQuery({
	sortable: ["createdAt", "role"],
	defaultSort: [{ field: "createdAt", direction: "asc" }],
	filter: {
		role: listFilter.enumeration(MembershipRoleSchema, { eq: true, in: true }),
	},
	params: {},
});
export const TenantMemberListQuerySchema = tenantMemberListQuery.schema;
export type TenantMemberListQuery = z.output<typeof TenantMemberListQuerySchema>;
export type TenantMemberListSortField = (typeof tenantMemberListQuery.sortable)[number];

/** `GET /tenants/:tenantSlug/members/invites` list query — the pending team invites, newest first. */
export const tenantMemberInviteListQuery = defineListQuery({
	sortable: ["createdAt", "expiresAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {},
	params: {},
});
export const TenantMemberInviteListQuerySchema = tenantMemberInviteListQuery.schema;
export type TenantMemberInviteListQuery = z.output<typeof TenantMemberInviteListQuerySchema>;
export type TenantMemberInviteListSortField = (typeof tenantMemberInviteListQuery.sortable)[number];

/** `POST /admin/tenants/invites` payload — the new tenant and the onboarding token to share with its owner. */
export const AdminTenantInviteCreatedResponseSchema = z.object({
	tenantId: z.uuid(),
	inviteToken: z.string().min(1),
});

export type AdminTenantInviteCreatedResponse = z.output<typeof AdminTenantInviteCreatedResponseSchema>;
