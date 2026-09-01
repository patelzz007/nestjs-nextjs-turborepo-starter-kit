import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { PermissionMigrationService } from "./permission-migration.service";

/**
 * Pushes code-registry permissions into the database on API startup.
 * Admin UI permission creates are DB-only and are never written to source.
 */
@Injectable()
export class PermissionRegistrySyncBootstrap implements OnModuleInit {
	private readonly logger: Logger = new Logger(PermissionRegistrySyncBootstrap.name);

	public constructor(private readonly migration: PermissionMigrationService) {}

	public onModuleInit(): void {
		void this.migration.syncFromRegistry().then((result) => {
			if (result.created.length > 0) {
				this.logger.log(`Permission registry sync: created ${String(result.created.length)} row(s)`);
			}
			if (result.updated.length > 0) {
				this.logger.log(`Permission registry sync: updated ${String(result.updated.length)} row(s)`);
			}
			if (result.orphaned.length > 0) {
				this.logger.debug(`Permission registry sync: ${String(result.orphaned.length)} DB-only permission(s) not in registry`);
			}
		});
	}
}
