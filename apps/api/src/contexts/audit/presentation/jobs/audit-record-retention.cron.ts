import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { PurgeExpiredAuditRecordsCommand } from "../../application/commands/purge-expired-audit-records/purge-expired-audit-records.command";
import { AUDIT_RECORD_RETENTION_OPERATION } from "../../application/ports/audit-retention.port";

/** Weekly: remove audit records past the ten-year retention, skipping legal holds (ADR 078). */
@Injectable()
export class AuditRecordRetentionCron {
	private readonly logger: Logger = new Logger(AuditRecordRetentionCron.name);

	public constructor(private readonly dispatcher: SystemCommandDispatcher) {}

	@Cron(CronExpression.EVERY_WEEK)
	public async purge(): Promise<void> {
		const actor = systemActor(AUDIT_RECORD_RETENTION_OPERATION, "cron", null, "Remove audit records past the ten-year retention", null);
		const runs = await this.dispatcher.dispatch(new PurgeExpiredAuditRecordsCommand(actor, false), { kind: "cron", name: "audit-record-retention" });
		for (const run of runs) {
			this.logger.log({ event: "audit.retention.run", ...run });
		}
	}
}
