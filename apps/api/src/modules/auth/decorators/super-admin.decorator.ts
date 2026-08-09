import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../guards/auth.guard.js";
import { SuperAdminGuard } from "../guards/super-admin.guard.js";

/** Metadata key for checking super admin status */
export const SUPER_ADMIN_KEY = "isSuperAdmin";

/**
 * Decorator that restricts access to admin-authorized users only.
 *
 * Access is granted if:
 * 1. The user has `isSuperAdmin === true`, OR
 * 2. The user has the `ADMIN_DASHBOARD` resource permission in their JWT.
 *
 * Combines:
 * 1. AuthGuard — ensures the user is authenticated
 * 2. SuperAdminGuard — checks isSuperAdmin or ADMIN_DASHBOARD permission
 *
 * Usage:
 * ```typescript
 * @SuperAdminOnly()
 * @Get("/admin/users")
 * public async getAdminUsersList() { ... }
 * ```
 */
export const SuperAdminOnly = (): ReturnType<typeof applyDecorators> => {
	return applyDecorators(SetMetadata(SUPER_ADMIN_KEY, true), UseGuards(AuthGuard, SuperAdminGuard));
};
