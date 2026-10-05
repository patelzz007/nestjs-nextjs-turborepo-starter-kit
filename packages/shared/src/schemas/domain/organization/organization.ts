import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import { CanonicalEmailSchema } from "../../api/email-address";
import { defineListQuery, listFilter } from "../../api/list-query";
import { strongPassword } from "../../auth/password";
import { IanaTimeZoneSchema } from "../rewards/analytics-time-zone";
import { KybStatusSchema, PilotCitySchema } from "../rewards/rewards-enums";

/** Organization lifecycle states — authoritative across API, workers, billing. */
export const OrganizationLifecycleStateSchema = z.enum(["PROVISIONING", "ACTIVE", "RESTRICTED", "SUSPENDED", "PENDING_DELETION", "DELETED"]);

export type OrganizationLifecycleState = z.output<typeof OrganizationLifecycleStateSchema>;

export const OrganizationMembershipRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "POLICY_ADMIN", "CASHIER"]);

export type OrganizationMembershipRole = z.output<typeof OrganizationMembershipRoleSchema>;

export const OrganizationMembershipStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "PENDING"]);

export type OrganizationMembershipStatus = z.output<typeof OrganizationMembershipStatusSchema>;

export const OrganizationLocationScopeTypeSchema = z.enum(["ALL_LOCATIONS", "SELECTED"]);

export type OrganizationLocationScopeType = z.output<typeof OrganizationLocationScopeTypeSchema>;

export const OrganizationLocationStatusSchema = z.enum(["PENDING_APPROVAL", "ACTIVE", "REJECTED", "INACTIVE"]);

export type OrganizationLocationStatus = z.output<typeof OrganizationLocationStatusSchema>;

export const OrganizationInvitationStatusSchema = z.enum(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]);

export type OrganizationInvitationStatus = z.output<typeof OrganizationInvitationStatusSchema>;

export const OrganizationInvitationKindSchema = z.enum(["PLATFORM_ONBOARDING", "TEAM_MEMBER"]);

export type OrganizationInvitationKind = z.output<typeof OrganizationInvitationKindSchema>;

export const OrganizationAccessRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

export type OrganizationAccessRequestStatus = z.output<typeof OrganizationAccessRequestStatusSchema>;

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

/** URL-safe organization slug. */
export const OrganizationSlugSchema = z
	.string()
	.min(2)
	.max(64)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export type OrganizationSlug = z.output<typeof OrganizationSlugSchema>;

/** Slug or organization id — accepted in `/orgs/:orgSlug` routes for backwards-compatible deep links. */
export const OrganizationRouteKeySchema = z.union([OrganizationSlugSchema, z.uuid()]);

export type OrganizationRouteKey = z.output<typeof OrganizationRouteKeySchema>;

export const OrganizationIdParamSchema = z.object({
	organizationId: z.uuid(),
});

export type OrganizationIdParam = z.output<typeof OrganizationIdParamSchema>;

export const OrganizationSlugParamSchema = z
	.object({
		orgSlug: OrganizationRouteKeySchema,
	})
	.strict();

export type OrganizationSlugParam = z.output<typeof OrganizationSlugParamSchema>;

/** Route params of `POST /orgs/:orgSlug/access-requests/:requestId/review`. */
export const OrganizationAccessRequestParamSchema = OrganizationSlugParamSchema.extend({
	requestId: z.uuid(),
}).strict();

export type OrganizationAccessRequestParam = z.output<typeof OrganizationAccessRequestParamSchema>;

export const OrganizationLocationResponseSchema = z.object({
	id: z.uuid(),
	organizationId: z.uuid(),
	name: z.string(),
	code: z.string(),
	addressText: z.string().nullable(),
	city: PilotCitySchema.nullable(),
	contactPhone: z.string().nullable(),
	status: OrganizationLocationStatusSchema,
	rejectionReason: z.string().nullable(),
	isPrimary: z.boolean(),
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type OrganizationLocationResponse = z.output<typeof OrganizationLocationResponseSchema>;

/** Draft store row for onboarding or admin pre-provisioning. */
export const OrganizationLocationDraftSchema = z
	.object({
		name: z.string().min(1).max(200),
		addressText: z.string().min(1).max(2000),
		contactPhone: z.string().min(1).max(20).optional(),
	})
	.strict();

export type OrganizationLocationDraft = z.output<typeof OrganizationLocationDraftSchema>;

/** Primary store draft during onboarding — contact phone is required. */
export const OrganizationPrimaryLocationDraftSchema = OrganizationLocationDraftSchema.extend({
	contactPhone: z.string().min(5).max(20),
});

export type OrganizationPrimaryLocationDraft = z.output<typeof OrganizationPrimaryLocationDraftSchema>;

export const OrganizationLocationCreateSchema = OrganizationLocationDraftSchema;

export type OrganizationLocationCreateInput = z.output<typeof OrganizationLocationCreateSchema>;

export const OrganizationLocationUpdateSchema = OrganizationLocationDraftSchema;

export type OrganizationLocationUpdateInput = z.output<typeof OrganizationLocationUpdateSchema>;

export const OrganizationLocationIdParamSchema = z
	.object({
		orgSlug: OrganizationRouteKeySchema,
		locationId: z.uuid(),
	})
	.strict();

export type OrganizationLocationIdParam = z.output<typeof OrganizationLocationIdParamSchema>;

/** Longest closure reason a merchant can record (stored on the location, echoed in the audit row). */
export const ORGANIZATION_LOCATION_CLOSURE_REASON_MAX_LENGTH = 500;

/** Close a store for good (bankruptcy, lease ended, ...): the reason is required and kept with the closed store. */
export const OrganizationLocationCloseSchema = z
	.object({
		reason: z.string().trim().min(1).max(ORGANIZATION_LOCATION_CLOSURE_REASON_MAX_LENGTH),
	})
	.strict();

export type OrganizationLocationCloseInput = z.output<typeof OrganizationLocationCloseSchema>;

/** What closing a store took with it (the store itself stays readable as history). */
export const OrganizationLocationCloseResponseSchema = z.object({
	locationId: z.uuid(),
	storeId: z.uuid(),
	closedAt: EpochMsSchema,
	reason: z.string(),
	storeMembershipsRemoved: z.number().int().nonnegative(),
	memberScopesRemoved: z.number().int().nonnegative(),
	terminalsRemoved: z.number().int().nonnegative(),
	apiKeysRevoked: z.number().int().nonnegative(),
});

export type OrganizationLocationCloseResponse = z.output<typeof OrganizationLocationCloseResponseSchema>;

export const OrganizationMemberStoreParamSchema = z
	.object({
		orgSlug: OrganizationSlugSchema,
		membershipId: z.uuid(),
		locationId: z.uuid(),
	})
	.strict();

export type OrganizationMemberStoreParam = z.output<typeof OrganizationMemberStoreParamSchema>;

/** Remove a team member from one store. A member left with no store at all is refused unless `allowNoStores` is set. */
export const OrganizationMemberStoreRemoveSchema = z
	.object({
		allowNoStores: z.boolean().default(false),
	})
	.strict();

export type OrganizationMemberStoreRemoveInput = z.output<typeof OrganizationMemberStoreRemoveSchema>;

export const OrganizationMemberStoreRemoveResponseSchema = z.object({
	membershipId: z.uuid(),
	locationId: z.uuid(),
	removedAt: EpochMsSchema,
	remainingLocationIds: z.array(z.uuid()),
});

export type OrganizationMemberStoreRemoveResponse = z.output<typeof OrganizationMemberStoreRemoveResponseSchema>;

export const AdminOrganizationLocationCreateSchema = z
	.object({
		name: z.string().min(1).max(200),
		addressText: z.string().min(1).max(2000),
		contactPhone: z.string().min(1).max(20).optional(),
		city: PilotCitySchema.optional(),
		approveImmediately: z.boolean().default(true),
	})
	.strict();

export type AdminOrganizationLocationCreateInput = z.output<typeof AdminOrganizationLocationCreateSchema>;

export const AdminOrganizationLocationReviewSchema = z
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

export type AdminOrganizationLocationReviewInput = z.output<typeof AdminOrganizationLocationReviewSchema>;

export const AdminOrganizationLocationReviewPathInputSchema = z
	.object({
		organizationId: z.uuid(),
		locationId: z.uuid(),
	})
	.strict();

export type AdminOrganizationLocationReviewPathInput = z.output<typeof AdminOrganizationLocationReviewPathInputSchema>;

/** Page size the admin location-request queue has always used. */
export const ADMIN_LOCATION_REQUEST_DEFAULT_LIMIT = 50;

/** `GET /admin/location-requests` list query — oldest first (a FIFO review queue); the queue view sends `filter[status]=PENDING_APPROVAL`. */
export const adminLocationRequestListQuery = defineListQuery({
	sortable: ["createdAt", "name"],
	defaultSort: [{ field: "createdAt", direction: "asc" }],
	filter: {
		status: listFilter.enumeration(OrganizationLocationStatusSchema, { eq: true, in: true }),
	},
	params: {},
	defaultLimit: ADMIN_LOCATION_REQUEST_DEFAULT_LIMIT,
});
export const AdminLocationRequestListQuerySchema = adminLocationRequestListQuery.schema;
export type AdminLocationRequestListQuery = z.output<typeof AdminLocationRequestListQuerySchema>;
export type AdminLocationRequestListSortField = (typeof adminLocationRequestListQuery.sortable)[number];

export const AdminLocationRequestResponseSchema = z.object({
	id: z.uuid(),
	organizationId: z.uuid(),
	organizationSlug: OrganizationSlugSchema,
	organizationDisplayName: z.string(),
	name: z.string(),
	code: z.string(),
	addressText: z.string().nullable(),
	city: PilotCitySchema.nullable(),
	contactPhone: z.string().nullable(),
	status: OrganizationLocationStatusSchema,
	rejectionReason: z.string().nullable(),
	isPrimary: z.boolean(),
	requestedByUserId: z.uuid().nullable(),
	createdAt: EpochMsSchema,
});

export type AdminLocationRequestResponse = z.output<typeof AdminLocationRequestResponseSchema>;

export const OrganizationMembershipResponseSchema = z.object({
	id: z.uuid(),
	organizationId: z.uuid(),
	userId: z.uuid(),
	role: OrganizationMembershipRoleSchema,
	status: OrganizationMembershipStatusSchema,
	displayName: z.string().nullable(),
	locationScopeType: OrganizationLocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type OrganizationMembershipResponse = z.output<typeof OrganizationMembershipResponseSchema>;

/** Longest display name a member can choose for one organization (`organization_memberships.display_name` is VARCHAR(100)). */
export const ORGANIZATION_MEMBER_DISPLAY_NAME_MAX_LENGTH = 100;

/** A member's display name for one organization: trimmed, never blank. */
export const OrganizationMemberDisplayNameSchema = z.string().trim().min(1).max(ORGANIZATION_MEMBER_DISPLAY_NAME_MAX_LENGTH);

/**
 * `PATCH /orgs/:orgSlug/members/me` — the signed-in member updates their OWN
 * membership. `displayName: null` clears it (the account's full name is shown
 * instead); a blank string is rejected rather than silently stored.
 */
export const OrganizationOwnMembershipUpdateSchema = z
	.object({
		displayName: OrganizationMemberDisplayNameSchema.nullable(),
	})
	.strict();

export type OrganizationOwnMembershipUpdateInput = z.output<typeof OrganizationOwnMembershipUpdateSchema>;

export const OrganizationSummaryResponseSchema = z.object({
	id: z.uuid(),
	slug: OrganizationSlugSchema,
	displayName: z.string(),
	lifecycleState: OrganizationLifecycleStateSchema,
	primaryLocationId: z.uuid().nullable(),
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type OrganizationSummaryResponse = z.output<typeof OrganizationSummaryResponseSchema>;

export const OrganizationMerchantProfileResponseSchema = z.object({
	organizationId: z.uuid(),
	legalName: z.string().nullable(),
	/** Null until the merchant submits a business category during onboarding. */
	category: z.string().nullable(),
	city: PilotCitySchema,
	kybStatus: KybStatusSchema,
	contactEmail: z.email(),
	contactPhone: z.string().nullable(),
});

export type OrganizationMerchantProfileResponse = z.output<typeof OrganizationMerchantProfileResponseSchema>;

/**
 * The organization as its own members see it in the context: the summary plus
 * the IANA zone the merchant operates in (`Organization.timeZone`) — the zone
 * merchant analytics cut days, weeks and months in, so a screen can resolve a
 * date range in it before asking for a report.
 */
export const OrganizationContextSummaryResponseSchema = OrganizationSummaryResponseSchema.extend({
	timeZone: IanaTimeZoneSchema,
});

export type OrganizationContextSummaryResponse = z.output<typeof OrganizationContextSummaryResponseSchema>;

export const OrganizationContextResponseSchema = z.object({
	organization: OrganizationContextSummaryResponseSchema,
	membership: OrganizationMembershipResponseSchema,
	locations: z.array(OrganizationLocationResponseSchema),
	merchantProfile: OrganizationMerchantProfileResponseSchema.nullable(),
	policyVersion: z.number().int().nonnegative(),
});

export type OrganizationContextResponse = z.output<typeof OrganizationContextResponseSchema>;

export const AdminCreateOrganizationInviteSchema = z
	.object({
		email: CanonicalEmailSchema,
		displayName: z.string().min(1).max(200),
		slug: OrganizationSlugSchema,
		intendedRole: OrganizationMembershipRoleSchema.default("OWNER"),
		city: PilotCitySchema,
		category: z.string().min(1).max(100),
	})
	.strict();

export type AdminCreateOrganizationInviteInput = z.output<typeof AdminCreateOrganizationInviteSchema>;

export const OrganizationAccessRequestCreateSchema = z
	.object({
		message: z.string().max(500).optional(),
	})
	.strict();

export type OrganizationAccessRequestCreateInput = z.output<typeof OrganizationAccessRequestCreateSchema>;

export const OrganizationAccessRequestResponseSchema = z.object({
	id: z.uuid(),
	organizationId: z.uuid(),
	userId: z.uuid(),
	status: OrganizationAccessRequestStatusSchema,
	message: z.string().nullable(),
	createdAt: EpochMsSchema,
});

export type OrganizationAccessRequestResponse = z.output<typeof OrganizationAccessRequestResponseSchema>;

/**
 * Roles a team manager may grant through a team invite or an access-request
 * approval. OWNER is never grantable this way (ownership is provisioned).
 */
export const OrganizationTeamGrantableRoleSchema = OrganizationMembershipRoleSchema.exclude(["OWNER"]);

export type OrganizationTeamGrantableRole = z.output<typeof OrganizationTeamGrantableRoleSchema>;

/** Upper bound on the store ids one membership scope may list. */
export const ORGANIZATION_SCOPE_MAX_LOCATION_IDS = 200;

/**
 * Approving an access request states the granted role and location scope
 * explicitly — nothing defaults to a permissive value. `SELECTED` needs at
 * least one (distinct) store; `ALL_LOCATIONS` takes none.
 */
const ReviewOrganizationAccessRequestApproveSchema = z
	.object({
		approve: z.literal(true),
		role: OrganizationTeamGrantableRoleSchema,
		locationScopeType: OrganizationLocationScopeTypeSchema,
		locationIds: z.array(z.uuid()).max(ORGANIZATION_SCOPE_MAX_LOCATION_IDS),
	})
	.strict();

const ReviewOrganizationAccessRequestRejectSchema = z
	.object({
		approve: z.literal(false),
	})
	.strict();

export const ReviewOrganizationAccessRequestSchema = z
	.discriminatedUnion("approve", [ReviewOrganizationAccessRequestApproveSchema, ReviewOrganizationAccessRequestRejectSchema])
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

export type ReviewOrganizationAccessRequestInput = z.output<typeof ReviewOrganizationAccessRequestSchema>;

const TEAM_INVITE_ROLES: readonly OrganizationMembershipRole[] = OrganizationTeamGrantableRoleSchema.options;

export const OrganizationMemberInviteFieldsSchema = z
	.object({
		email: CanonicalEmailSchema,
		role: OrganizationMembershipRoleSchema,
		locationScopeType: OrganizationLocationScopeTypeSchema.default("ALL_LOCATIONS"),
		locationIds: z.array(z.uuid()).default([]),
	})
	.strict();

export type OrganizationMemberInviteFields = z.output<typeof OrganizationMemberInviteFieldsSchema>;

export const OrganizationMemberInviteSchema = OrganizationMemberInviteFieldsSchema.superRefine((value, ctx): void => {
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

export type OrganizationMemberInviteInput = z.output<typeof OrganizationMemberInviteSchema>;

export const OrganizationMemberRosterResponseSchema = z.object({
	id: z.uuid(),
	organizationId: z.uuid(),
	userId: z.uuid(),
	email: z.email(),
	fullName: z.string(),
	role: OrganizationMembershipRoleSchema,
	status: OrganizationMembershipStatusSchema,
	displayName: z.string().nullable(),
	locationScopeType: OrganizationLocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type OrganizationMemberRosterResponse = z.output<typeof OrganizationMemberRosterResponseSchema>;

export const OrganizationMemberInviteResponseSchema = z.object({
	id: z.uuid(),
	organizationId: z.uuid(),
	email: z.email(),
	intendedRole: OrganizationMembershipRoleSchema,
	locationScopeType: OrganizationLocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
	status: OrganizationInvitationStatusSchema,
	invitedByUserId: z.uuid(),
	invitedByName: z.string(),
	expiresAt: EpochMsSchema,
	createdAt: EpochMsSchema,
});

export type OrganizationMemberInviteResponse = z.output<typeof OrganizationMemberInviteResponseSchema>;

export const OrganizationMemberInviteCreatedResponseSchema = z.object({
	inviteId: z.uuid(),
	message: z.string(),
});

export type OrganizationMemberInviteCreatedResponse = z.output<typeof OrganizationMemberInviteCreatedResponseSchema>;

export const OrganizationMemberInviteIdParamSchema = z
	.object({
		orgSlug: OrganizationSlugSchema,
		inviteId: z.uuid(),
	})
	.strict();

export type OrganizationMemberInviteIdParam = z.output<typeof OrganizationMemberInviteIdParamSchema>;

export const OrganizationTeamInviteTokenSchema = z
	.object({
		token: z.string().min(16).max(256),
	})
	.strict();

export type OrganizationTeamInviteTokenInput = z.output<typeof OrganizationTeamInviteTokenSchema>;

export const OrganizationTeamInviteRegisterAcceptSchema = OrganizationTeamInviteTokenSchema.extend({
	fullName: z.string().min(2, "Full name must be at least 2 characters"),
	password: strongPassword,
}).strict();

export type OrganizationTeamInviteRegisterAcceptInput = z.output<typeof OrganizationTeamInviteRegisterAcceptSchema>;

export const OrganizationTeamInvitePreviewSchema = z.object({
	email: z.email(),
	organizationDisplayName: z.string(),
	organizationSlug: OrganizationSlugSchema,
	intendedRole: OrganizationMembershipRoleSchema,
	locationScopeType: OrganizationLocationScopeTypeSchema,
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

export type OrganizationTeamInvitePreview = z.output<typeof OrganizationTeamInvitePreviewSchema>;

export const OrganizationTeamInviteAcceptResponseSchema = z.object({
	organizationSlug: OrganizationSlugSchema,
	message: z.string(),
});

export type OrganizationTeamInviteAcceptResponse = z.output<typeof OrganizationTeamInviteAcceptResponseSchema>;

export const PolicyBuilderPayloadSchema = z
	.object({
		templateId: z.string(),
		parameters: z.record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())])),
	})
	.strict();

export type PolicyBuilderPayload = z.output<typeof PolicyBuilderPayloadSchema>;

export const AuthorizationPolicyDraftResponseSchema = z.object({
	id: z.uuid(),
	organizationId: z.uuid().nullable(),
	scope: AuthorizationPolicyScopeSchema,
	name: z.string(),
	status: AuthorizationPolicyStatusSchema,
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type AuthorizationPolicyDraftResponse = z.output<typeof AuthorizationPolicyDraftResponseSchema>;

export const SupportAccessGrantRequestSchema = z
	.object({
		organizationId: z.uuid(),
		reason: z.string().min(10).max(2000),
		ticketRef: z.string().max(120).optional(),
		mode: SupportAccessGrantModeSchema.default("READ_ONLY"),
		durationMinutes: z.number().int().min(15).max(480).default(60),
	})
	.strict();

export type SupportAccessGrantRequestInput = z.output<typeof SupportAccessGrantRequestSchema>;

export const SupportAccessGrantResponseSchema = z.object({
	id: z.uuid(),
	organizationId: z.uuid(),
	mode: SupportAccessGrantModeSchema,
	status: SupportAccessGrantStatusSchema,
	expiresAt: EpochMsSchema,
	createdAt: EpochMsSchema,
});

export type SupportAccessGrantResponse = z.output<typeof SupportAccessGrantResponseSchema>;

export const OrganizationDeletionRequestSchema = z
	.object({
		confirmDisplayName: z.string().min(1),
	})
	.strict();

export type OrganizationDeletionRequestInput = z.output<typeof OrganizationDeletionRequestSchema>;

export const OrganizationQuotaStatusSchema = z.object({
	quotaKey: z.string(),
	limitValue: z.number().int().nonnegative(),
	usedValue: z.number().int().nonnegative(),
	windowEnd: EpochMsSchema,
});

export type OrganizationQuotaStatus = z.output<typeof OrganizationQuotaStatusSchema>;

export { OrganizationLocationFilterSchema, type OrganizationLocationFilter } from "./location-filter";

/** `GET /orgs/:orgSlug/members` payload — the (bounded) member roster. */
export const OrganizationMemberRosterListResponseSchema = z.array(OrganizationMemberRosterResponseSchema);

/** `GET /orgs/:orgSlug/members/invites` payload — the (bounded) pending invite roster. */
export const OrganizationMemberInviteListResponseSchema = z.array(OrganizationMemberInviteResponseSchema);

/** `POST /admin/organizations/invites` payload — the new organization and the onboarding token to share with its owner. */
export const AdminOrganizationInviteCreatedResponseSchema = z.object({
	organizationId: z.uuid(),
	inviteToken: z.string().min(1),
});

export type AdminOrganizationInviteCreatedResponse = z.output<typeof AdminOrganizationInviteCreatedResponseSchema>;
