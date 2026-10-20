import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { PurgeOldPermissionAuditLogsCommand } from "../../application/commands/purge-old-permission-audit-logs/purge-old-permission-audit-logs.command";
import { AUDIT_LOG_RETENTION_OPERATION } from "../../application/ports/authorization.tokens";
import { authorizationSystemActor } from "../../application/services/rbac-actor";

/** Hourly: soft-delete permission audit rows past retention (one UPDATE on the `createdAt` index). */
@Injectable()
export class AuditLogRetentionCron {
	private readonly logger: Logger = new Logger(AuditLogRetentionCron.name);

	public constructor(private readonly dispatcher: SystemCommandDispatcher) {}

	@Cron(CronExpression.EVERY_HOUR)
	public async purgeOldAuditLogs(): Promise<void> {
		const actor = authorizationSystemActor(AUDIT_LOG_RETENTION_OPERATION, "cron", "Soft-delete permission audit rows past retention");
		const retired: number = await this.dispatcher.dispatch(new PurgeOldPermissionAuditLogsCommand(actor), { kind: "cron", name: "permission-audit-log-retention" });
		if (retired > 0) {
			this.logger.log(`Soft-deleted ${String(retired)} authorization audit logs older than 90 days`);
		}
	}
}
