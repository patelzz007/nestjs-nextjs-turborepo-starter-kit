import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";

import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { SyncCapabilityCatalogCommand } from "../../application/commands/sync-capability-catalog/sync-capability-catalog.command";
import { SyncPermissionRegistryCommand } from "../../application/commands/sync-permission-registry/sync-permission-registry.command";
import { CAPABILITY_CATALOG_SYNC_OPERATION, PERMISSION_REGISTRY_SYNC_OPERATION } from "../../application/ports/authorization.tokens";
import type { CapabilityCatalogSyncResult, PermissionRegistrySyncResult } from "../../application/ports/catalog-sync.port";
import { authorizationSystemActor } from "../../application/services/rbac-actor";

/**
 * D21 / decision #45: the permission registry, then the PLATFORM capability catalog, synced as audited
 * bootstrap commands under the catalog-sync advisory lock and AWAITED in `onApplicationBootstrap`, so
 * `app.init()` (and therefore `listen` and `HealthService.markReady`) completes only once the catalog is
 * consistent. It is registered in the non-global HTTP module, whose hook runs after the global
 * `CqrsModule` has registered the command handlers. A full sync runs
 * on every boot (decisions #62, #68). A failure fails the boot.
 */
@Injectable()
export class AuthorizationCatalogSyncBootstrap implements OnApplicationBootstrap {
	private readonly logger: Logger = new Logger(AuthorizationCatalogSyncBootstrap.name);

	public constructor(private readonly dispatcher: SystemCommandDispatcher) {}

	public async onApplicationBootstrap(): Promise<void> {
		const registry: PermissionRegistrySyncResult = await this.dispatcher.dispatch(
			new SyncPermissionRegistryCommand(
				authorizationSystemActor(PERMISSION_REGISTRY_SYNC_OPERATION, "bootstrap", "Push the code permission registry into the permission catalog at boot"),
			),
			{ kind: "bootstrap", name: "permission-registry-sync" },
		);
		if (registry.created.length > 0 || registry.updated.length > 0) {
			this.logger.log(`Permission registry sync: created ${String(registry.created.length)}, updated ${String(registry.updated.length)} row(s)`);
		}
		if (registry.orphaned.length > 0) {
			this.logger.debug(`Permission registry sync: ${String(registry.orphaned.length)} DB-only permission(s) not in registry`);
		}
		const capabilities: CapabilityCatalogSyncResult = await this.dispatcher.dispatch(
			new SyncCapabilityCatalogCommand(
				authorizationSystemActor(CAPABILITY_CATALOG_SYNC_OPERATION, "bootstrap", "Converge platform capability definitions to the permission catalog at boot"),
			),
			{ kind: "bootstrap", name: "capability-catalog-sync" },
		);
		this.logger.log(`Platform capability definitions: ${String(capabilities.created)} created, ${String(capabilities.updated)} updated`);
	}
}
