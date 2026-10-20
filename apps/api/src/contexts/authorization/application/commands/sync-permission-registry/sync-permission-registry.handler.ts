import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { getPermissionDefinitions } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { AuthorizationScope } from "../../authorization-scope";
import type { AuthorizationCacheInvalidationPort } from "../../ports/authorization-cache-invalidation.port";
import { AUTHORIZATION_CACHE_INVALIDATION, AUTHORIZATION_UNIT_OF_WORK, PERMISSION_REGISTRY_SYNC_OPERATION } from "../../ports/authorization.tokens";
import type { PermissionRegistrySyncResult } from "../../ports/catalog-sync.port";
import { SyncPermissionRegistryCommand } from "./sync-permission-registry.command";

/**
 * D21: ONE transaction under `authorization.permission_registry.sync`, holding the catalog-sync advisory
 * lock, so replicas booting together sync one after the other (the second finds nothing to create). A full
 * sync runs on every boot (decisions #62, #68). Admin-created permissions are never written back to code
 * and never deleted. Cached authorization is cleared everywhere only after commit.
 */
@CommandHandler(SyncPermissionRegistryCommand)
export class SyncPermissionRegistryHandler implements ICommandHandler<SyncPermissionRegistryCommand, PermissionRegistrySyncResult> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		@Inject(AUTHORIZATION_CACHE_INVALIDATION) private readonly invalidation: AuthorizationCacheInvalidationPort,
	) {}

	public async execute(command: SyncPermissionRegistryCommand): Promise<PermissionRegistrySyncResult> {
		const result: PermissionRegistrySyncResult = await this.uow.runSystemOperation(
			PERMISSION_REGISTRY_SYNC_OPERATION,
			command.actor,
			async (scope: AuthorizationScope): Promise<PermissionRegistrySyncResult> => {
				await scope.catalog.lockCatalogSync();
				return scope.catalog.syncPermissionDefinitions(getPermissionDefinitions());
			},
		);
		if (result.created.length > 0 || result.updated.length > 0) {
			await this.invalidation.clearAll();
		}
		return result;
	}
}
