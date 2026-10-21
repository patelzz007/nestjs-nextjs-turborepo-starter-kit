// API contract leaves owned by the `authorization` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { adminRbacRoutes, capabilitiesRoutes, supportAccessRoutes } from "./routes";
import { CapabilityCatalogQuerySchema, CapabilityCatalogResponseSchema } from "./schemas/capabilities";
import { AssignPermissionToUserSchema, AssignRoleToUserSchema, CheckPermissionSchema, SyncUserPermissionsSchema, SyncUserRolesSchema } from "./schemas/rbac";
import { RbacMessageResponseSchema } from "./schemas/rbac-inspection";
import { CheckPermissionResponseSchema, PermissionListItemSchema, PermissionListQuerySchema } from "./schemas/rbac-permissions";
import { RoleListItemSchema, RoleListQuerySchema } from "./schemas/rbac-roles";
import { MessageResponseSchema } from "../../schemas/api/message";
import { UuidParamSchema } from "../../schemas/domain/platform/param-schemas";
import {
	SupportAccessGrantDetailListSchema,
	SupportAccessGrantDetailSchema,
	SupportAccessGrantListQuerySchema,
	SupportAccessGrantRequestSchema,
	SupportAccessGrantResponseSchema,
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
