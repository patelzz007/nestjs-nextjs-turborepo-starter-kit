import { Module } from "@nestjs/common";

import { AuthorizationCatalogSyncBootstrap } from "../jobs/authorization-catalog-sync.bootstrap";
import { AuditController } from "./audit.controller";
import { AuthorizationDecisionsController } from "./authorization-decisions.controller";
import { CapabilitiesCatalogController } from "./capabilities-catalog.controller";
import { PermissionsController } from "./permissions.controller";
import { RolesController } from "./roles.controller";
import { SupportAccessController, TenantSupportAccessController } from "./support-access.controller";
import { TenantAccessController } from "./tenant-access.controller";

/**
 * The authorization HTTP surface and the boot-time catalog sync. Not global: its
 * `onApplicationBootstrap` (the catalog sync) runs after the global `CqrsModule` registered the handlers.
 * Its `SystemCommandDispatcher` comes from the global `AuthorizationModule`, which re-exports `SystemCommandModule`.
 */
@Module({
	controllers: [
		RolesController,
		PermissionsController,
		AuditController,
		CapabilitiesCatalogController,
		AuthorizationDecisionsController,
		SupportAccessController,
		TenantSupportAccessController,
		TenantAccessController,
	],
	providers: [AuthorizationCatalogSyncBootstrap],
})
export class AuthorizationHttpModule {}
