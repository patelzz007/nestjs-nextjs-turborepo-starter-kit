import { Command } from "@nestjs/cqrs";

import type { CapabilityCatalogSyncResult } from "../../ports/catalog-sync.port";
import type { SystemActor } from "../../services/rbac-mutation-scope";

/** Converge the PLATFORM capability definitions to the permission catalog. */
export class SyncCapabilityCatalogCommand extends Command<CapabilityCatalogSyncResult> {
	public constructor(public readonly actor: SystemActor) {
		super();
	}
}
