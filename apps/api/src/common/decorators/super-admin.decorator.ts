import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../guards/auth.guard";
import { SuperAdminGuard } from "../guards/super-admin.guard";

/** Metadata key for checking super admin status */
export const SUPER_ADMIN_KEY = "isSuperAdmin";

/**
 * Decorator that restricts access to SuperAdmin users only.
 *
 * Combines:
 * 1. AuthGuard — ensures the user is authenticated
 * 2. SuperAdminGuard — ensures the user has isSuperAdmin === true
 *
 * Usage:
 * ```typescript
 * @SuperAdminOnly()
 * @Post("/impersonate/:userId")
 * public async impersonate(...) { ... }
 * ```
 */
export const SuperAdminOnly = (): ReturnType<typeof applyDecorators> => {
	return applyDecorators(
		SetMetadata(SUPER_ADMIN_KEY, true),
		UseGuards(AuthGuard, SuperAdminGuard),
	);
};
