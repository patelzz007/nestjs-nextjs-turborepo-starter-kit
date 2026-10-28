import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { PermissionPairSchema } from "../../../authorization/permission";
import { LocationScopeTypeSchema, MembershipRoleSchema } from "../../tenancy/schemas/tenant";
import { PermissionActionSchema, PermissionResourceSchema, ShareLevelSchema } from "./permission-enums";

/**
 * Tenant access administration contracts (ADR 067): a tenant's own roles, the extra permissions it
 * grants its members, and the records it shares with them. One request shape per operation, used by
 * the API (the authority) and the merchant app (for user experience) alike.
 */

const RoleNameSchema = z.string().trim().min(1).max(100);
/** A `noun.verb` in a RESPONSE: open, like every response schema (ADR 022 — clients tolerate added fields). */
const PermissionInResponseSchema = z.object({ action: PermissionActionSchema, resource: PermissionResourceSchema });
const PermissionListSchema = z.array(PermissionPairSchema).max(200);

/** A tenant role, with the members who hold it. */
export const TenantRoleResponseSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	/** The template this role was copied from (`null`: a role the tenant created itself). */
	templateKey: MembershipRoleSchema.nullable(),
	permissions: z.array(PermissionInResponseSchema),
	holderCount: z.number().int().nonnegative(),
});
export type TenantRoleResponse = z.output<typeof TenantRoleResponseSchema>;

/** `GET …/access/roles` — one schema for the handler and the contract (the OpenAPI document checks they match). */
export const TenantRoleListResponseSchema = z.array(TenantRoleResponseSchema);

export const TenantRoleCreateSchema = z.object({ name: RoleNameSchema, permissions: PermissionListSchema }).strict();
export type TenantRoleCreateInput = z.output<typeof TenantRoleCreateSchema>;

export const TenantRoleUpdateSchema = z.object({ name: RoleNameSchema.optional(), permissions: PermissionListSchema.optional() }).strict();
export type TenantRoleUpdateInput = z.output<typeof TenantRoleUpdateSchema>;

/** Deleting a role members still hold answers 409 with them, and the version of that list. */
export const TenantRoleHoldersSchema = z.object({
	holders: z.array(z.object({ membershipId: z.uuid(), userId: z.uuid(), fullName: z.string(), email: z.email() })),
	/** Pass back to `reassign`: it fails if anyone joined or left the role in between. */
	holdersVersion: z.string().min(1),
});
export type TenantRoleHolders = z.output<typeof TenantRoleHoldersSchema>;

/** Every holder of a role moved to a new role, in one transaction, against the holder list it was made for. */
export const TenantRoleReassignSchema = z
	.object({
		holdersVersion: z.string().min(1),
		assignments: z
			.array(z.object({ membershipId: z.uuid(), roleId: z.uuid() }).strict())
			.min(1)
			.max(1000),
	})
	.strict();
export type TenantRoleReassignInput = z.output<typeof TenantRoleReassignSchema>;

/** One member, as the access screens show them: who, which role, which stores. */
export const TenantMemberAccessResponseSchema = z.object({
	membershipId: z.uuid(),
	userId: z.uuid(),
	fullName: z.string(),
	email: z.email(),
	roleId: z.uuid(),
	roleName: z.string(),
	templateKey: MembershipRoleSchema.nullable(),
	locationScopeType: LocationScopeTypeSchema,
	locationIds: z.array(z.uuid()),
});
export type TenantMemberAccessResponse = z.output<typeof TenantMemberAccessResponseSchema>;

export const TenantMemberRoleSchema = z.object({ roleId: z.uuid() }).strict();
export type TenantMemberRoleInput = z.output<typeof TenantMemberRoleSchema>;

/** An extra permission for one member: the whole tenant or one store, permanent or until `expiresAt`. */
export const TenantGrantCreateSchema = z
	.object({
		permission: PermissionPairSchema,
		locationId: z.uuid().optional(),
		expiresAt: EpochMsSchema.optional(),
	})
	.strict();
export type TenantGrantCreateInput = z.output<typeof TenantGrantCreateSchema>;

export const TenantGrantResponseSchema = z.object({
	id: z.uuid(),
	membershipId: z.uuid(),
	permission: PermissionInResponseSchema,
	locationId: z.uuid().nullable(),
	expiresAt: EpochMsSchema.nullable(),
	grantedBy: z.string().nullable(),
	grantedVia: z.string().nullable(),
	grantedAt: EpochMsSchema,
});
export type TenantGrantResponse = z.output<typeof TenantGrantResponseSchema>;

/** `GET …/access/members/:membershipId/grants`. */
export const TenantGrantListResponseSchema = z.array(TenantGrantResponseSchema);

/** The record types a tenant can share one of (ADR 067: rewards first; one entry per new type). */
export const ShareableResourceSchema = z.enum(["REWARD"]);
export type ShareableResource = z.output<typeof ShareableResourceSchema>;

export const TenantShareCreateSchema = z
	.object({
		resource: ShareableResourceSchema,
		resourceId: z.uuid(),
		membershipId: z.uuid(),
		level: ShareLevelSchema,
		expiresAt: EpochMsSchema.optional(),
	})
	.strict();
export type TenantShareCreateInput = z.output<typeof TenantShareCreateSchema>;

export const TenantShareResponseSchema = z.object({
	id: z.uuid(),
	resource: ShareableResourceSchema,
	resourceId: z.uuid(),
	membershipId: z.uuid(),
	level: ShareLevelSchema,
	expiresAt: EpochMsSchema.nullable(),
	sharedBy: z.string().nullable(),
	sharedAt: EpochMsSchema,
});
export type TenantShareResponse = z.output<typeof TenantShareResponseSchema>;

/** `GET …/access/shares`. */
export const TenantShareListResponseSchema = z.array(TenantShareResponseSchema);
