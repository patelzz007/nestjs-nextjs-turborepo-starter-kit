import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../../../schemas/api/common";
import { CanonicalEmailSchema } from "../../../schemas/api/email-address";
import { defineListQuery, listFilter, ListSearchSchema } from "../../../schemas/api/list-query";
import { JsonObjectSchema } from "../../../schemas/runtime/json";
import { REWARD_LIST_DEFAULT_LIMIT } from "../../rewards/schemas/reward";
import { MerchantKybDocumentRecordSchema } from "./merchant-kyb";
import { TenantLifecycleStateSchema, LocationResponseSchema, MembershipRoleSchema, TenantSlugSchema } from "./tenant";
import { KybStatusSchema, MerchantTenantStatusSchema, PilotCitySchema } from "./tenant-enums";

// ── Merchant tenants: admin directory, merchant invites, tenant memberships ──

/** `GET /admin/merchants` list query. */
export const adminMerchantListQuery = defineListQuery({
	sortable: ["createdAt", "displayName"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		city: listFilter.enumeration(PilotCitySchema, { eq: true, in: true }),
		kybStatus: listFilter.enumeration(KybStatusSchema, { eq: true, in: true }),
		status: listFilter.enumeration(MerchantTenantStatusSchema, { eq: true, in: true }),
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
		tenantId: z.uuid(),
	})
	.strict();

export type AdminMerchantIdParam = z.output<typeof AdminMerchantIdParamSchema>;

export const AdminMerchantInviteCreatedResponseSchema = z.object({
	inviteId: z.uuid(),
	inviteToken: z.string().min(1),
	expiresAt: EpochMsSchema,
});

export type AdminMerchantInviteCreatedResponse = z.output<typeof AdminMerchantInviteCreatedResponseSchema>;

/**
 * `GET /admin/invites/availability` — whether this deployment may invite a new merchant. A
 * single-tenant deployment serves its one seeded tenant, so `POST /admin/invites` is refused there
 * (403 TENANT_PROVISIONING_DISABLED) and the admin panel hides the invite page.
 */
export const AdminMerchantInviteAvailabilitySchema = z.object({
	available: z.boolean().meta({ description: "True when a new merchant (and its tenant) may be invited", example: true }),
});

export type AdminMerchantInviteAvailability = z.output<typeof AdminMerchantInviteAvailabilitySchema>;

export const MerchantTenantResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	businessName: z.string(),
	legalName: z.string().nullable(),
	category: z.string(),
	addressText: z.string().nullable(),
	city: PilotCitySchema,
	kybStatus: KybStatusSchema,
	status: MerchantTenantStatusSchema,
	contactEmail: z.string(),
	contactPhone: z.string().nullable(),
	/** Populated on admin merchant directory responses when an owner member exists. */
	ownerUserId: z.uuid().nullable().optional(),
});

export type MerchantTenantResponse = z.output<typeof MerchantTenantResponseSchema>;

/** Admin merchant detail for KYB review — includes verification payload and owner context. */
export const AdminMerchantDetailResponseSchema = MerchantTenantResponseSchema.extend({
	kybFields: JsonObjectSchema.nullable(),
	documents: z.array(MerchantKybDocumentRecordSchema),
	locations: z.array(LocationResponseSchema),
	ownerUserId: z.uuid().nullable(),
	ownerEmail: z.string().nullable(),
	ownerFullName: z.string().nullable(),
	memberCount: z.number().int().nonnegative(),
});

export type AdminMerchantDetailResponse = z.output<typeof AdminMerchantDetailResponseSchema>;

/** One of the caller's tenant memberships, tenant-scoped (replaces legacy TenantRewardMembershipResponse). */
export const TenantRewardMembershipResponseSchema = z.object({
	tenantId: z.uuid(),
	tenantSlug: TenantSlugSchema,
	displayName: z.string(),
	role: MembershipRoleSchema,
	kybStatus: KybStatusSchema,
	lifecycleState: TenantLifecycleStateSchema,
	createdAt: EpochMsSchema.optional(),
});

export type TenantRewardMembershipResponse = z.output<typeof TenantRewardMembershipResponseSchema>;

/**
 * `GET /tenants/memberships` list query — the signed-in user's own active memberships, in the order they joined
 * (the merchant app's store switcher and stores page). `search` matches the tenant's name or slug.
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
