import { Command } from "@nestjs/cqrs";

import type { ReferenceDataSyncReport } from "../../ports/catalog-sync.port";
import type { SystemActor } from "../../services/rbac-mutation-scope";

/** `db:sync-reference-data`: converge the platform reference data to the code's catalog. */
export class SyncReferenceDataCommand extends Command<ReferenceDataSyncReport> {
	public constructor(public readonly actor: SystemActor) {
		super();
	}
}
