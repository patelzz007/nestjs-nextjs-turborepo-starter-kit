import { Module } from "@nestjs/common";

import { AuthorizationCatalogSyncBootstrap } from "../jobs/authorization-catalog-sync.bootstrap";
import { AuditController } from "./audit.controller";
import { AuthorizationDecisionsController } from "./authorization-decisions.controller";
import { CapabilitiesCatalogController } from "./capabilities-catalog.controller";
import { PermissionsController } from "./permissions.controller";
import { PolicyControlPlaneController } from "./policy-control-plane.controller";
import { RolesController } from "./roles.controller";
import { SupportAccessController } from "./support-access.controller";

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
		PolicyControlPlaneController,
		SupportAccessController,
	],
	providers: [AuthorizationCatalogSyncBootstrap],
})
export class AuthorizationHttpModule {}
