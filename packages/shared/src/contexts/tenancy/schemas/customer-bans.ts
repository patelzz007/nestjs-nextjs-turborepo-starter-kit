import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery } from "../../../schemas/api/list-query";
import { TenantSlugParamSchema } from "./tenant";

/**
 * A merchant's bans of its own customers. A banned customer cannot claim the merchant's rewards, and
 * the merchant's tills refuse their codes. Merchants never see who a customer is, so a ban is made
 * from one of the customer's redemptions in the redemption log, and the banned-customers list names
 * each ban by that redemption (reward and time) — never by the customer's name or email.
 */

/** Longest reason a merchant gives for a ban (kept for the merchant's staff; never shown to the customer). */
export const TENANT_CUSTOMER_BAN_REASON_MAX_LENGTH = 500;

/** Rows per page of the banned-customers list. */
export const TENANT_CUSTOMER_BAN_LIST_DEFAULT_LIMIT = 20;

/** `POST /tenants/:tenantSlug/customer-bans`: ban the customer behind one of the tenant's redemptions. */
export const TenantCustomerBanCreateSchema = z
	.object({
		redemptionId: z.uuid(),
		reason: z.string().trim().min(1).max(TENANT_CUSTOMER_BAN_REASON_MAX_LENGTH),
	})
	.strict();

export type TenantCustomerBanCreateInput = z.output<typeof TenantCustomerBanCreateSchema>;

/** `POST /tenants/:tenantSlug/customer-bans/:banId/lift`. */
export const TenantCustomerBanParamSchema = TenantSlugParamSchema.extend({ banId: z.uuid() }).strict();

export type TenantCustomerBanParam = z.output<typeof TenantCustomerBanParamSchema>;

/** `GET /tenants/:tenantSlug/customer-bans`: the tenant's active bans, newest first. */
export const tenantCustomerBanListQuery = defineListQuery({
	sortable: ["bannedAt"],
	defaultSort: [{ field: "bannedAt", direction: "desc" }],
	filter: {},
	params: {},
	defaultLimit: TENANT_CUSTOMER_BAN_LIST_DEFAULT_LIMIT,
});

export const TenantCustomerBanListQuerySchema = tenantCustomerBanListQuery.schema;

export type TenantCustomerBanListQuery = z.output<typeof TenantCustomerBanListQuerySchema>;

export type TenantCustomerBanListSortField = (typeof tenantCustomerBanListQuery.sortable)[number];

/** One active ban: when and why, who made it, and the redemption it was made from (how staff recognise the customer). */
export const TenantCustomerBanResponseSchema = z.object({
	id: z.uuid(),
	reason: z.string(),
	bannedAt: EpochMsSchema,
	/** null when the member's account no longer exists. */
	bannedBy: z.object({ id: z.uuid(), fullName: z.string() }).nullable(),
	/** null once that redemption no longer exists. */
	source: z.object({ redemptionId: z.uuid(), rewardTitle: z.string(), redeemedAt: EpochMsSchema }).nullable(),
});

export type TenantCustomerBanResponse = z.output<typeof TenantCustomerBanResponseSchema>;
