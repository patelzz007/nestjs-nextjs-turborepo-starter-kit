import { z } from "zod";

import { EpochMsSchema } from "../api/common";
import { PilotCitySchema } from "./rewards";
import { KybStatusSchema } from "./rewards";

/** Organization lifecycle states — authoritative across API, workers, billing. */
export const OrganizationLifecycleStateSchema = z.enum([
	"PROVISIONING",
	"ACTIVE",
	"RESTRICTED",
	"SUSPENDED",
	"PENDING_DELETION",
	"DELETED",
]);

export type OrganizationLifecycleState = z.output<typeof OrganizationLifecycleStateSchema>;

export const OrganizationMembershipRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "POLICY_ADMIN", "CASHIER"]);

export type OrganizationMembershipRole = z.output<typeof OrganizationMembershipRoleSchema>;

export const OrganizationMembershipStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "PENDING"]);

export type OrganizationMembershipStatus = z.output<typeof OrganizationMembershipStatusSchema>;

export const OrganizationLocationScopeTypeSchema = z.enum(["ALL_LOCATIONS", "SELECTED"]);

export type OrganizationLocationScopeType = z.output<typeof OrganizationLocationScopeTypeSchema>;

export const OrganizationInvitationStatusSchema = z.enum(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]);

export type OrganizationInvitationStatus = z.output<typeof OrganizationInvitationStatusSchema>;

export const OrganizationAccessRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

export type OrganizationAccessRequestStatus = z.output<typeof OrganizationAccessRequestStatusSchema>;

export const AuthorizationPolicyScopeSchema = z.enum(["PLATFORM_GUARDRAIL", "PLATFORM", "TENANT"]);

export type AuthorizationPolicyScope = z.output<typeof AuthorizationPolicyScopeSchema>;

export const AuthorizationPolicyStatusSchema = z.enum([
	"DRAFT",
	"PENDING_APPROVAL",
	"APPROVED",
	"PUBLISHED",
	"SUPERSEDED",
	"ROLLED_BACK",
]);

export type AuthorizationPolicyStatus = z.output<typeof AuthorizationPolicyStatusSchema>;

export const SupportAccessGrantModeSchema = z.enum(["READ_ONLY", "WRITE_ELEVATED"]);

export type SupportAccessGrantMode = z.output<typeof SupportAccessGrantModeSchema>;

export const SupportAccessGrantStatusSchema = z.enum([
	"PENDING_APPROVAL",
	"PENDING_TENANT_APPROVAL",
	"ACTIVE",
	"EXPIRED",
	"REVOKED",
	"DENIED",
]);

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

export const OrganizationIdParamSchema = z.object({
	organizationId: z.uuid(),
});

export type OrganizationIdParam = z.output<typeof OrganizationIdParamSchema>;

export const OrganizationSlugParamSchema = z.object({
	orgSlug: OrganizationSlugSchema,
});

export type OrganizationSlugParam = z.output<typeof OrganizationSlugParamSchema>;

export const OrganizationLocationResponseSchema = z
	.object({
		id: z.uuid(),
		organizationId: z.uuid(),
		name: z.string(),
		code: z.string(),
		isPrimary: z.boolean(),
		createdAt: EpochMsSchema,
		updatedAt: EpochMsSchema,
	})
	.strict();

export type OrganizationLocationResponse = z.output<typeof OrganizationLocationResponseSchema>;

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
		contactEmail: z.string().email(),
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
	})
	.strict();

export type ReviewOrganizationAccessRequestInput = z.output<typeof ReviewOrganizationAccessRequestSchema>;

export const OrganizationMemberInviteSchema = z
	.object({
		email: z.email(),
		role: OrganizationMembershipRoleSchema,
		locationScopeType: OrganizationLocationScopeTypeSchema.default("ALL_LOCATIONS"),
		locationIds: z.array(z.uuid()).default([]),
	})
	.strict();

export type OrganizationMemberInviteInput = z.output<typeof OrganizationMemberInviteSchema>;

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
