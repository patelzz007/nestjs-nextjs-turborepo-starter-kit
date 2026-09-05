import { Module } from "@nestjs/common";

import { AuditController } from "./audit.controller";
import { PermissionsController } from "./permissions.controller";
import { RolesController } from "./roles.controller";
import { CapabilitiesCatalogController } from "../controllers/capabilities-catalog.controller";
import { NavigationMenuController } from "../controllers/navigation-menu.controller";

/**
 * Admin-facing REST endpoints for managing roles and permissions.
 *
 * Protected by `@RequirePermission` decorators on each handler —
 * the global `AuthGuard` + `AuthorizationGuard` enforce them.
 */
@Module({
	controllers: [RolesController, PermissionsController, AuditController, CapabilitiesCatalogController, NavigationMenuController],
})
export class AuthorizationAdminModule {}
