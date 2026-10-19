import { Command } from "@nestjs/cqrs";

import type { SystemActor } from "../../services/rbac-mutation-scope";

/** Soft-delete permission audit rows older than the retention period. @returns how many were retired. */
export class PurgeOldPermissionAuditLogsCommand extends Command<number> {
	public constructor(public readonly actor: SystemActor) {
		super();
	}
}
