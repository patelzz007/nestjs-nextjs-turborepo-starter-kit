import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { TenantLifecycleStateSchema } from "./tenant";

/**
 * Tenant lifecycle routes (multi-tenancy plan MT-23). A platform admin suspends and reinstates a
 * tenant; a suspended tenant's owner or admin appeals; a tenant pending deletion is reactivated by
 * its owner; any member leaves. The tenant-side routes run while the tenant is suspended, banned or
 * pending deletion (`@TenantLifecycleRoute()`); leaving also runs for a suspended or pending membership.
 *
 * A super admin bans a tenant (harder than a suspension: no appeal, no reactivation) and lifts the ban.
 */

/** Longest reason, appeal or review note on a lifecycle change. */
export const TENANT_LIFECYCLE_TEXT_MAX_LENGTH = 1000;

const LifecycleTextSchema = z.string().trim().min(1).max(TENANT_LIFECYCLE_TEXT_MAX_LENGTH);

export const TenantAppealStatusSchema = z.enum(["PENDING", "ACCEPTED", "REJECTED"]);

export type TenantAppealStatus = z.output<typeof TenantAppealStatusSchema>;

const LifecyclePersonSchema = z.object({ id: z.uuid(), fullName: z.string() });

/** One appeal against a suspension, with the platform's answer once it is reviewed. */
export const TenantSuspensionAppealResponseSchema = z.object({
	id: z.uuid(),
	status: TenantAppealStatusSchema,
	message: z.string(),
	/** null when the submitting account no longer exists. */
	submittedBy: LifecyclePersonSchema.nullable(),
	createdAt: EpochMsSchema,
	reviewedAt: EpochMsSchema.nullable(),
	reviewNote: z.string().nullable(),
});

export type TenantSuspensionAppealResponse = z.output<typeof TenantSuspensionAppealResponseSchema>;

/** The tenant's lifecycle: its state, why it was suspended, and its appeals (newest first). */
export const TenantLifecycleResponseSchema = z.object({
	tenantId: z.uuid(),
	lifecycleState: TenantLifecycleStateSchema,
	/** Until when the owner may reactivate a tenant pending deletion; null otherwise. */
	deletionGraceEndsAt: EpochMsSchema.nullable(),
	/** The latest suspension (when and why) while the tenant is suspended; null otherwise. */
	suspension: z.object({ suspendedAt: EpochMsSchema, reason: z.string().nullable() }).nullable(),
	/** The ban (when and why) while the tenant is banned; null otherwise. */
	ban: z.object({ bannedAt: EpochMsSchema, reason: z.string().nullable() }).nullable(),
	appeals: z.array(TenantSuspensionAppealResponseSchema),
});

export type TenantLifecycleResponse = z.output<typeof TenantLifecycleResponseSchema>;

/** `POST /tenants/:tenantSlug/lifecycle/appeals`: the tenant's case for reinstatement. */
export const TenantAppealCreateSchema = z.object({ message: LifecycleTextSchema }).strict();

export type TenantAppealCreateInput = z.output<typeof TenantAppealCreateSchema>;

/** `POST /tenants/:tenantSlug/members/me/leave`: what the caller left. */
export const TenantMembershipLeaveResponseSchema = z.object({
	tenantId: z.uuid(),
	membershipId: z.uuid(),
	leftAt: EpochMsSchema,
});

export type TenantMembershipLeaveResponse = z.output<typeof TenantMembershipLeaveResponseSchema>;

/** `POST /admin/merchants/:tenantId/suspend` and `/reinstate`: why the platform changes the tenant's state. */
export const AdminTenantLifecycleChangeSchema = z.object({ reason: LifecycleTextSchema }).strict();

export type AdminTenantLifecycleChangeInput = z.output<typeof AdminTenantLifecycleChangeSchema>;

/** `POST /admin/merchants/:tenantId/appeals/:appealId/reject`: the answer shown to the tenant. */
export const AdminTenantAppealRejectSchema = z.object({ note: LifecycleTextSchema }).strict();

export type AdminTenantAppealRejectInput = z.output<typeof AdminTenantAppealRejectSchema>;

export const AdminTenantAppealParamSchema = z.object({ tenantId: z.uuid(), appealId: z.uuid() }).strict();

export type AdminTenantAppealParam = z.output<typeof AdminTenantAppealParamSchema>;
