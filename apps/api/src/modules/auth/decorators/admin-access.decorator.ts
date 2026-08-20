import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";

import { AdminAccessGuard } from "../guards/admin-access.guard";
import { ADMIN_ACCESS_MESSAGE_KEY } from "../utils/admin-access";

/**
 * Restricts a controller or handler to JWT access tokens with `hasAdminAccess`.
 * Assumes the global `AuthGuard` has already authenticated the caller.
 *
 * ```typescript
 * @AdminAccessOnly("Admin access required to manage database backups.")
 * @Controller(apiPath("/backup"))
 * export class BackupController { ... }
 * ```
 */
export function AdminAccessOnly(message = "Admin access required."): ReturnType<typeof applyDecorators> {
	return applyDecorators(SetMetadata(ADMIN_ACCESS_MESSAGE_KEY, message), UseGuards(AdminAccessGuard));
}
