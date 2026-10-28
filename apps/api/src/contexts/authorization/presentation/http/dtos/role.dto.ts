import { CreateRoleSchema, SyncUserRolesSchema, UpdateRoleSchema, ValidateRoleAssignmentSchema, AssignRoleToUserSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/** Body for POST /admin/roles */
export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}

/** Body for PATCH /admin/roles/:id */
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}

/** Body for POST /admin/roles/:id/validate-assignment and /admin/roles/preview */
export class ValidateRoleAssignmentDto extends createZodDto(ValidateRoleAssignmentSchema) {}

/** Body for POST /admin/roles/user/assign and /admin/roles/user/remove */
export class AssignRoleToUserDto extends createZodDto(AssignRoleToUserSchema) {}

/** Body for POST /admin/roles/user/sync */
export class SyncUserRolesDto extends createZodDto(SyncUserRolesSchema) {}
