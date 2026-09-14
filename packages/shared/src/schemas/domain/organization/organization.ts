import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import { strongPassword } from "../../auth/password";
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

export const OrganizationLocationResponseSchema = z
	.object({
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
	})
	.strict();

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

export const AdminLocationRequestListQuerySchema = z
	.object({
		page: z.coerce.number().int().positive().default(1),
		limit: z.coerce.number().int().min(1).max(100).default(50),
		status: OrganizationLocationStatusSchema.default("PENDING_APPROVAL"),
	})
	.strict();

export type AdminLocationRequestListQuery = z.output<typeof AdminLocationRequestListQuerySchema>;

export const AdminLocationRequestResponseSchema = z
	.object({
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
	})
	.strict();

export type AdminLocationRequestResponse = z.output<typeof AdminLocationRequestResponseSchema>;

export const OrganizationMembershipResponseSchema = z
	.object({
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
	})
	.strict();

export type OrganizationMembershipResponse = z.output<typeof OrganizationMembershipResponseSchema>;

export const OrganizationSummaryResponseSchema = z
	.object({
		id: z.uuid(),
		slug: OrganizationSlugSchema,
		displayName: z.string(),
		lifecycleState: OrganizationLifecycleStateSchema,
		primaryLocationId: z.uuid().nullable(),
		createdAt: EpochMsSchema,
		updatedAt: EpochMsSchema,
	})
	.strict();

export type OrganizationSummaryResponse = z.output<typeof OrganizationSummaryResponseSchema>;

export const OrganizationMerchantProfileResponseSchema = z
	.object({
		organizationId: z.uuid(),
		legalName: z.string().nullable(),
		category: z.string(),
		city: PilotCitySchema,
		kybStatus: KybStatusSchema,
		contactEmail: z.email(),
		contactPhone: z.string().nullable(),
	})
	.strict();

export type OrganizationMerchantProfileResponse = z.output<typeof OrganizationMerchantProfileResponseSchema>;

export const OrganizationContextResponseSchema = z
	.object({
		organization: OrganizationSummaryResponseSchema,
		membership: OrganizationMembershipResponseSchema,
		locations: z.array(OrganizationLocationResponseSchema),
		merchantProfile: OrganizationMerchantProfileResponseSchema.nullable(),
		policyVersion: z.number().int().nonnegative(),
	})
	.strict();

export type OrganizationContextResponse = z.output<typeof OrganizationContextResponseSchema>;

export const AdminCreateOrganizationInviteSchema = z
	.object({
		email: z.email(),
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

export const OrganizationAccessRequestResponseSchema = z
	.object({
		id: z.uuid(),
		organizationId: z.uuid(),
		userId: z.uuid(),
		status: OrganizationAccessRequestStatusSchema,
		message: z.string().nullable(),
		createdAt: EpochMsSchema,
	})
	.strict();

export type OrganizationAccessRequestResponse = z.output<typeof OrganizationAccessRequestResponseSchema>;

export const ReviewOrganizationAccessRequestSchema = z
	.object({
		approve: z.boolean(),
		role: OrganizationMembershipRoleSchema.optional(),
		locationScopeType: OrganizationLocationScopeTypeSchema.optional(),
		locationIds: z.array(z.uuid()).default([]),
	})
	.strict()
	.superRefine((value, ctx): void => {
		if (value.approve && value.locationScopeType === "SELECTED" && value.locationIds.length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "Select at least one location",
				path: ["locationIds"],
			});
		}
	});

export type ReviewOrganizationAccessRequestInput = z.output<typeof ReviewOrganizationAccessRequestSchema>;

const TEAM_INVITE_ROLES: readonly OrganizationMembershipRole[] = ["ADMIN", "MEMBER", "POLICY_ADMIN", "CASHIER"];

export const OrganizationMemberInviteFieldsSchema = z
	.object({
		email: z.email(),
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

export const OrganizationMemberRosterResponseSchema = z
	.object({
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
	})
	.strict();

export type OrganizationMemberRosterResponse = z.output<typeof OrganizationMemberRosterResponseSchema>;

export const OrganizationMemberInviteResponseSchema = z
	.object({
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
	})
	.strict();

export type OrganizationMemberInviteResponse = z.output<typeof OrganizationMemberInviteResponseSchema>;

export const OrganizationMemberInviteCreatedResponseSchema = z
	.object({
		inviteId: z.uuid(),
		message: z.string(),
	})
	.strict();

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

export const OrganizationTeamInviteRegisterAcceptSchema = z
	.object({
		token: z.string().min(16).max(256),
		fullName: z.string().min(2, "Full name must be at least 2 characters"),
		password: strongPassword,
	})
	.strict();

export type OrganizationTeamInviteRegisterAcceptInput = z.output<typeof OrganizationTeamInviteRegisterAcceptSchema>;

export const OrganizationTeamInvitePreviewSchema = z
	.object({
		email: z.email(),
		organizationDisplayName: z.string(),
		organizationSlug: OrganizationSlugSchema,
		intendedRole: OrganizationMembershipRoleSchema,
		locationScopeType: OrganizationLocationScopeTypeSchema,
		locationIds: z.array(z.uuid()),
		locationLabels: z.array(
			z
				.object({
					id: z.uuid(),
					name: z.string(),
				})
				.strict(),
		),
		expiresAt: EpochMsSchema,
		hasExistingAccount: z.boolean(),
	})
	.strict();

export type OrganizationTeamInvitePreview = z.output<typeof OrganizationTeamInvitePreviewSchema>;

export const OrganizationTeamInviteAcceptResponseSchema = z
	.object({
		organizationSlug: OrganizationSlugSchema,
		message: z.string(),
	})
	.strict();

export type OrganizationTeamInviteAcceptResponse = z.output<typeof OrganizationTeamInviteAcceptResponseSchema>;

export const PolicyBuilderPayloadSchema = z
	.object({
		templateId: z.string(),
		parameters: z.record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())])),
	})
	.strict();

export type PolicyBuilderPayload = z.output<typeof PolicyBuilderPayloadSchema>;

export const AuthorizationPolicyDraftResponseSchema = z
	.object({
		id: z.uuid(),
		organizationId: z.uuid().nullable(),
		scope: AuthorizationPolicyScopeSchema,
		name: z.string(),
		status: AuthorizationPolicyStatusSchema,
		createdAt: EpochMsSchema,
		updatedAt: EpochMsSchema,
	})
	.strict();

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

export const SupportAccessGrantResponseSchema = z
	.object({
		id: z.uuid(),
		organizationId: z.uuid(),
		mode: SupportAccessGrantModeSchema,
		status: SupportAccessGrantStatusSchema,
		expiresAt: EpochMsSchema,
		createdAt: EpochMsSchema,
	})
	.strict();

export type SupportAccessGrantResponse = z.output<typeof SupportAccessGrantResponseSchema>;

export const OrganizationDeletionRequestSchema = z
	.object({
		confirmDisplayName: z.string().min(1),
	})
	.strict();

export type OrganizationDeletionRequestInput = z.output<typeof OrganizationDeletionRequestSchema>;

export const OrganizationQuotaStatusSchema = z
	.object({
		quotaKey: z.string(),
		limitValue: z.number().int().nonnegative(),
		usedValue: z.number().int().nonnegative(),
		windowEnd: EpochMsSchema,
	})
	.strict();

export type OrganizationQuotaStatus = z.output<typeof OrganizationQuotaStatusSchema>;

export { OrganizationLocationFilterSchema, type OrganizationLocationFilter } from "./location-filter";
