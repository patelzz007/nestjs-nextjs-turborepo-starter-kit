import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { AuthorizationScope } from "../../authorization-scope";
import { AUTHORIZATION_UNIT_OF_WORK, CAPABILITY_CATALOG_READ, CAPABILITY_CATALOG_SYNC_OPERATION } from "../../ports/authorization.tokens";
import type { CapabilityCatalogSyncResult } from "../../ports/catalog-sync.port";
import type { CapabilityCatalogReadPort } from "../../ports/rbac-read.port";
import { SyncCapabilityCatalogCommand } from "./sync-capability-catalog.command";

/**
 * One attributed transaction (`authorization.capability_catalog.sync`) under the catalog-sync advisory
 * lock. Only missing or changed rows are written, so an up-to-date database records no change (ADR 051).
 */
@CommandHandler(SyncCapabilityCatalogCommand)
export class SyncCapabilityCatalogHandler implements ICommandHandler<SyncCapabilityCatalogCommand, CapabilityCatalogSyncResult> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		@Inject(CAPABILITY_CATALOG_READ) private readonly catalog: CapabilityCatalogReadPort,
	) {}

	public async execute(command: SyncCapabilityCatalogCommand): Promise<CapabilityCatalogSyncResult> {
		const result: CapabilityCatalogSyncResult = await this.uow.runSystemOperation(
			CAPABILITY_CATALOG_SYNC_OPERATION,
			command.actor,
			async (scope: AuthorizationScope): Promise<CapabilityCatalogSyncResult> => {
				await scope.catalog.lockCatalogSync();
				return scope.catalog.convergePlatformCapabilities();
			},
		);
		this.catalog.invalidate();
		return result;
	}
}
