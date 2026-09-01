import {
	AssignPermissionToUserSchema,
	BulkAssignPermissionsSchema,
	CheckPermissionSchema,
	CreatePermissionExtendedSchema,
	SyncUserPermissionsSchema,
} from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/** Body for POST /admin/permissions/user/grant and /user/revoke */
export class GrantPermissionToUserDto extends createZodDto(AssignPermissionToUserSchema) {}

/** Body for POST /admin/permissions/user/sync */
export class SyncUserPermissionsDto extends createZodDto(SyncUserPermissionsSchema) {}

/** Body for POST /admin/permissions/check */
export class CheckPermissionDto extends createZodDto(CheckPermissionSchema) {}

/** Body for POST /admin/permissions */
export class CreatePermissionDto extends createZodDto(CreatePermissionExtendedSchema) {}

/** Body for POST /admin/roles/:id/permissions */
export class SyncRolePermissionsDto extends createZodDto(BulkAssignPermissionsSchema) {}
