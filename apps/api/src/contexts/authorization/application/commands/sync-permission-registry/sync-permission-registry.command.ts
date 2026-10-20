import { Command } from "@nestjs/cqrs";

import type { PermissionRegistrySyncResult } from "../../ports/catalog-sync.port";
import type { SystemActor } from "../../services/rbac-mutation-scope";

/** Push the code permission registry into `Permission` (registry → database only). */
export class SyncPermissionRegistryCommand extends Command<PermissionRegistrySyncResult> {
	public constructor(public readonly actor: SystemActor) {
		super();
	}
}
