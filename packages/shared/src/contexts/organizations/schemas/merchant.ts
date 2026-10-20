import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../../../schemas/api/common";
import { CanonicalEmailSchema } from "../../../schemas/api/email-address";
import { defineListQuery, listFilter, ListSearchSchema } from "../../../schemas/api/list-query";
import { JsonObjectSchema } from "../../../schemas/runtime/json";
import { REWARD_LIST_DEFAULT_LIMIT } from "../../rewards/schemas/reward";
import { MerchantKybDocumentRecordSchema } from "./merchant-kyb";
import { OrganizationLifecycleStateSchema, OrganizationLocationResponseSchema, OrganizationMembershipRoleSchema, OrganizationSlugSchema } from "./organization";
import { KybStatusSchema, MerchantOrgStatusSchema, PilotCitySchema } from "./organization-enums";

// ── Merchant organizations: admin directory, merchant invites, organization memberships ──

/** `GET /admin/merchants` list query. */
export const adminMerchantListQuery = defineListQuery({
	sortable: ["createdAt", "displayName"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		city: listFilter.enumeration(PilotCitySchema, { eq: true, in: true }),
		kybStatus: listFilter.enumeration(KybStatusSchema, { eq: true, in: true }),
		status: listFilter.enumeration(MerchantOrgStatusSchema, { eq: true, in: true }),
	},
	params: { search: ListSearchSchema },
	defaultLimit: REWARD_LIST_DEFAULT_LIMIT,
});

export const AdminMerchantListQuerySchema = adminMerchantListQuery.schema;

export type AdminMerchantListQuery = z.output<typeof AdminMerchantListQuerySchema>;

export type AdminMerchantListSortField = (typeof adminMerchantListQuery.sortable)[number];

export const AdminCreateMerchantInviteSchema = z
	.object({
		email: CanonicalEmailSchema,
		businessName: z.string().min(1).max(200),
		city: PilotCitySchema,
	})
	.strict();

export type AdminCreateMerchantInviteInput = z.output<typeof AdminCreateMerchantInviteSchema>;

/**
 * Live preview of the merchant invite email (`GET /admin/invites/preview-email`): only
 * what shapes the rendered email. The business name is optional — the template's sample
 * name stands in until the admin types one. The recipient is not part of it: the email's
 * body never shows it, and as a GET it would otherwise land in request logs and caches.
 */
export const AdminMerchantInvitePreviewQuerySchema = AdminCreateMerchantInviteSchema.pick({ businessName: true, city: true }).partial({ businessName: true });

export type AdminMerchantInvitePreviewQuery = z.output<typeof AdminMerchantInvitePreviewQuerySchema>;

export const AdminMerchantIdParamSchema = z
	.object({
		organizationId: z.uuid(),
	})
	.strict();

export type AdminMerchantIdParam = z.output<typeof AdminMerchantIdParamSchema>;

export const AdminMerchantInviteCreatedResponseSchema = z.object({
	inviteId: z.uuid(),
	inviteToken: z.string().min(1),
	expiresAt: EpochMsSchema,
});

export type AdminMerchantInviteCreatedResponse = z.output<typeof AdminMerchantInviteCreatedResponseSchema>;

export const MerchantOrgResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	businessName: z.string(),
	legalName: z.string().nullable(),
	category: z.string(),
	addressText: z.string().nullable(),
	city: PilotCitySchema,
	kybStatus: KybStatusSchema,
	status: MerchantOrgStatusSchema,
	contactEmail: z.string(),
	contactPhone: z.string().nullable(),
	/** Populated on admin merchant directory responses when an owner member exists. */
	ownerUserId: z.uuid().nullable().optional(),
});

export type MerchantOrgResponse = z.output<typeof MerchantOrgResponseSchema>;

/** Admin merchant detail for KYB review — includes verification payload and owner context. */
export const AdminMerchantDetailResponseSchema = MerchantOrgResponseSchema.extend({
	kybFields: JsonObjectSchema.nullable(),
	documents: z.array(MerchantKybDocumentRecordSchema),
	locations: z.array(OrganizationLocationResponseSchema),
	ownerUserId: z.uuid().nullable(),
	ownerEmail: z.string().nullable(),
	ownerFullName: z.string().nullable(),
	memberCount: z.number().int().nonnegative(),
});

export type AdminMerchantDetailResponse = z.output<typeof AdminMerchantDetailResponseSchema>;

/** One of the caller's organization memberships, organization-scoped (replaces legacy OrganizationRewardMembershipResponse). */
export const OrganizationRewardMembershipResponseSchema = z.object({
	organizationId: z.uuid(),
	organizationSlug: OrganizationSlugSchema,
	displayName: z.string(),
	role: OrganizationMembershipRoleSchema,
	kybStatus: KybStatusSchema,
	lifecycleState: OrganizationLifecycleStateSchema,
	createdAt: EpochMsSchema.optional(),
});

export type OrganizationRewardMembershipResponse = z.output<typeof OrganizationRewardMembershipResponseSchema>;

/**
 * `GET /orgs/memberships` list query — the signed-in user's own active memberships, in the order they joined
 * (the merchant app's store switcher and stores page). `search` matches the organization's name or slug.
 */
export const ownMembershipListQuery = defineListQuery({
	sortable: ["createdAt", "displayName"],
	defaultSort: [{ field: "createdAt", direction: "asc" }],
	filter: {},
	params: { search: ListSearchSchema },
});

export const OwnMembershipListQuerySchema = ownMembershipListQuery.schema;

export type OwnMembershipListQuery = z.output<typeof OwnMembershipListQuerySchema>;

export type OwnMembershipListSortField = (typeof ownMembershipListQuery.sortable)[number];
