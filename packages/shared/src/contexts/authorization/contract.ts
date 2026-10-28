// API contract leaves owned by the `authorization` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { adminRbacRoutes, capabilitiesRoutes, supportAccessRoutes, tenantAccessRoutes } from "./routes";
import { CapabilityCatalogQuerySchema, CapabilityCatalogResponseSchema } from "./schemas/capabilities";
import { AssignPermissionToUserSchema, AssignRoleToUserSchema, CheckPermissionSchema, SyncUserPermissionsSchema, SyncUserRolesSchema } from "./schemas/rbac";
import { RbacMessageResponseSchema } from "./schemas/rbac-inspection";
import { CheckPermissionResponseSchema, PermissionListItemSchema, PermissionListQuerySchema } from "./schemas/rbac-permissions";
import { RoleListItemSchema, RoleListQuerySchema } from "./schemas/rbac-roles";
import {
	TenantGrantCreateSchema,
	TenantGrantListResponseSchema,
	TenantGrantResponseSchema,
	TenantMemberAccessResponseSchema,
	TenantMemberRoleSchema,
	TenantRoleCreateSchema,
	TenantRoleHoldersSchema,
	TenantRoleListResponseSchema,
	TenantRoleReassignSchema,
	TenantRoleResponseSchema,
	TenantRoleUpdateSchema,
	TenantShareCreateSchema,
	TenantShareListResponseSchema,
	TenantShareResponseSchema,
} from "./schemas/tenant-access";
import { MessageResponseSchema, OkResponseSchema } from "../../schemas/api/message";
import { UuidParamSchema } from "../../schemas/domain/platform/param-schemas";
import {
	SupportAccessGrantDetailListSchema,
	SupportAccessGrantDetailSchema,
	SupportAccessGrantListQuerySchema,
	SupportAccessGrantRequestSchema,
	SupportAccessGrantResponseSchema,
	TenantRouteKeySchema,
	TenantSlugParamSchema,
} from "../tenancy/schemas/tenant";

/** Contract leaves composed into `apiContract.capabilities`. */
export const capabilitiesContract = {
	catalog: defineContract({
		method: "GET",
		path: capabilitiesRoutes.catalog,
		input: CapabilityCatalogQuerySchema,
		response: singleResponse(CapabilityCatalogResponseSchema),
	}),
};

/** Contract leaves composed into `apiContract.admin`. */
export const adminRbacContract = {
	roles: {
		list: defineContract({ method: "GET", path: adminRbacRoutes.roles.list, input: RoleListQuerySchema, response: paginatedResponse(RoleListItemSchema) }),
		userAssign: defineContract({
			method: "POST",
			path: adminRbacRoutes.roles.userAssign,
			input: AssignRoleToUserSchema,
			response: singleResponse(RbacMessageResponseSchema),
		}),
		userRemove: defineContract({
			method: "POST",
			path: adminRbacRoutes.roles.userRemove,
			input: AssignRoleToUserSchema,
			response: singleResponse(RbacMessageResponseSchema),
		}),
		userSync: defineContract({ method: "POST", path: adminRbacRoutes.roles.userSync, input: SyncUserRolesSchema, response: singleResponse(RbacMessageResponseSchema) }),
	},
	permissions: {
		list: defineContract({ method: "GET", path: adminRbacRoutes.permissions.list, input: PermissionListQuerySchema, response: paginatedResponse(PermissionListItemSchema) }),
		check: defineContract({
			method: "POST",
			path: adminRbacRoutes.permissions.check,
			input: CheckPermissionSchema,
			response: singleResponse(CheckPermissionResponseSchema),
		}),
		userGrant: defineContract({
			method: "POST",
			path: adminRbacRoutes.permissions.userGrant,
			input: AssignPermissionToUserSchema,
			response: singleResponse(RbacMessageResponseSchema),
		}),
		userRevoke: defineContract({
			method: "POST",
			path: adminRbacRoutes.permissions.userRevoke,
			input: AssignPermissionToUserSchema,
			response: singleResponse(RbacMessageResponseSchema),
		}),
		userSync: defineContract({
			method: "POST",
			path: adminRbacRoutes.permissions.userSync,
			input: SyncUserPermissionsSchema,
			response: singleResponse(RbacMessageResponseSchema),
		}),
	},
};

/** Just-in-time support access: a platform admin requests a grant, the tenant owner approves it, it expires or is revoked. */
export const supportAccessContract = {
	list: defineContract({
		method: "GET",
		path: supportAccessRoutes.list,
		input: SupportAccessGrantListQuerySchema,
		response: paginatedResponse(SupportAccessGrantDetailSchema),
	}),
	tenantList: defineContract({
		method: "GET",
		path: supportAccessRoutes.tenantList,
		input: TenantSlugParamSchema,
		response: singleResponse(SupportAccessGrantDetailListSchema),
	}),
	request: defineContract({
		method: "POST",
		path: supportAccessRoutes.request,
		input: SupportAccessGrantRequestSchema,
		response: singleResponse(SupportAccessGrantResponseSchema),
	}),
	approve: defineContract({
		method: "POST",
		path: supportAccessRoutes.approve,
		input: z.object({ grantId: UuidParamSchema }).strict(),
		response: singleResponse(MessageResponseSchema),
	}),
	revoke: defineContract({
		method: "POST",
		path: supportAccessRoutes.revoke,
		input: z.object({ grantId: UuidParamSchema }).strict(),
		response: singleResponse(MessageResponseSchema),
	}),
};

const RoleParamSchema = z.object({ tenantSlug: TenantRouteKeySchema, roleId: UuidParamSchema }).strict();
const MemberParamSchema = z.object({ tenantSlug: TenantRouteKeySchema, membershipId: UuidParamSchema }).strict();

/** Contract leaves composed into `apiContract.tenantAccess` (ADR 067): path params and body in one input. */
export const tenantAccessContract = {
	roles: defineContract({ method: "GET", path: tenantAccessRoutes.roles, input: TenantSlugParamSchema, response: singleResponse(TenantRoleListResponseSchema) }),
	createRole: defineContract({
		method: "POST",
		path: tenantAccessRoutes.roles,
		input: TenantRoleCreateSchema.extend({ tenantSlug: TenantRouteKeySchema }),
		response: singleResponse(TenantRoleResponseSchema),
	}),
	updateRole: defineContract({
		method: "PATCH",
		path: tenantAccessRoutes.role,
		input: TenantRoleUpdateSchema.extend(RoleParamSchema.shape),
		response: singleResponse(TenantRoleResponseSchema),
	}),
	deleteRole: defineContract({ method: "DELETE", path: tenantAccessRoutes.role, input: RoleParamSchema, response: singleResponse(OkResponseSchema) }),
	roleHolders: defineContract({ method: "GET", path: tenantAccessRoutes.roleHolders, input: RoleParamSchema, response: singleResponse(TenantRoleHoldersSchema) }),
	reassignHolders: defineContract({
		method: "POST",
		path: tenantAccessRoutes.roleReassign,
		input: TenantRoleReassignSchema.extend(RoleParamSchema.shape),
		response: singleResponse(OkResponseSchema),
	}),
	resetRole: defineContract({ method: "POST", path: tenantAccessRoutes.roleReset, input: RoleParamSchema, response: singleResponse(TenantRoleResponseSchema) }),
	member: defineContract({ method: "GET", path: tenantAccessRoutes.member, input: MemberParamSchema, response: singleResponse(TenantMemberAccessResponseSchema) }),
	changeMemberRole: defineContract({
		method: "PUT",
		path: tenantAccessRoutes.memberRole,
		input: TenantMemberRoleSchema.extend(MemberParamSchema.shape),
		response: singleResponse(OkResponseSchema),
	}),
	removeMember: defineContract({ method: "DELETE", path: tenantAccessRoutes.member, input: MemberParamSchema, response: singleResponse(OkResponseSchema) }),
	memberGrants: defineContract({
		method: "GET",
		path: tenantAccessRoutes.memberGrants,
		input: MemberParamSchema,
		response: singleResponse(TenantGrantListResponseSchema),
	}),
	grant: defineContract({
		method: "POST",
		path: tenantAccessRoutes.memberGrants,
		input: TenantGrantCreateSchema.extend(MemberParamSchema.shape),
		response: singleResponse(TenantGrantResponseSchema),
	}),
	revokeGrant: defineContract({
		method: "DELETE",
		path: tenantAccessRoutes.grant,
		input: z.object({ tenantSlug: TenantRouteKeySchema, grantId: UuidParamSchema }).strict(),
		response: singleResponse(OkResponseSchema),
	}),
	shares: defineContract({ method: "GET", path: tenantAccessRoutes.shares, input: TenantSlugParamSchema, response: singleResponse(TenantShareListResponseSchema) }),
	share: defineContract({
		method: "POST",
		path: tenantAccessRoutes.shares,
		input: TenantShareCreateSchema.extend({ tenantSlug: TenantRouteKeySchema }),
		response: singleResponse(TenantShareResponseSchema),
	}),
	unshare: defineContract({
		method: "DELETE",
		path: tenantAccessRoutes.share,
		input: z.object({ tenantSlug: TenantRouteKeySchema, shareId: UuidParamSchema }).strict(),
		response: singleResponse(OkResponseSchema),
	}),
};
