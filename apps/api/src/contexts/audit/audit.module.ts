import { Module } from "@nestjs/common";

import { TypedConfigService } from "../../config/typed-config.service";
import { AuditTrailService } from "../../platform/infrastructure/audit/audit-trail.service";
import { PgListenConnection, type OpenListenConnection } from "../../platform/infrastructure/database/pg-listen-connection";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { PurgeExpiredAuditRecordsHandler } from "./application/commands/purge-expired-audit-records/purge-expired-audit-records.handler";
import { AUDIT_READ_SESSION, type AuditReadSession } from "./application/ports/audit-read-session.port";
import { AUDIT_RETENTION, type AuditRetentionPort } from "./application/ports/audit-retention.port";
import { AUDIT_TRAIL_SIGNALS } from "./application/ports/audit-trail-signals.port";
import { GetDataChangeHandler } from "./application/queries/get-data-change/get-data-change.handler";
import { GetHttpAuditLogHandler } from "./application/queries/get-http-audit-log/get-http-audit-log.handler";
import { ListAuditTrailHandler } from "./application/queries/list-audit-trail/list-audit-trail.handler";
import { ListDataChangesHandler } from "./application/queries/list-data-changes/list-data-changes.handler";
import { ListHttpAuditLogsHandler } from "./application/queries/list-http-audit-logs/list-http-audit-logs.handler";
import { AUDIT_TRAIL_LISTEN_CONNECTION } from "./infrastructure/adapters/audit-trail-listen-connection";
import { PgAuditTrailSignals } from "./infrastructure/adapters/pg-audit-trail-signals.adapter";
import { PrismaAuditReadSession } from "./infrastructure/persistence/prisma-audit-read-session";
import { PrismaAuditRetentionAdapter } from "./infrastructure/persistence/prisma-audit-retention.adapter";
import { AuditRecordRetentionCron } from "./presentation/jobs/audit-record-retention.cron";
import { AuditLogsController } from "./presentation/http/audit-logs.controller";
import { AuditTrailController } from "./presentation/http/audit-trail.controller";
import { DataChangesController } from "./presentation/http/data-changes.controller";

/**
 * The audit context: the read side of both audit stores — the HTTP request
 * trail (`AuditLog`, ADR 025) and the row-level data-change trail
 * (`DataChangeLog`, ADR 051) — served to the admin audit log as one
 * timeline (`/admin/audit-trail`) plus each store's complete records. Queries,
 * plus the one write ADR 078 allows: removing records past the ten-year retention
 * through `app_purge_audit_batch` (the weekly `AuditRecordRetentionCron`). The write sides are the global `AuditLogModule` in
 * `platform/infrastructure/audit` (HTTP) and the database capture triggers
 * (row changes); this context never writes an audit row except the
 * sensitive-read row of its own reads, in the read's own transaction. The live
 * signal (`/admin/audit-trail/events`) comes from the database's
 * `NOTIFY audit_trail` (prisma/rls/95-audit-trail-notify.sql).
 */
@Module({
	imports: [PrismaModule, SystemCommandModule],
	controllers: [AuditTrailController, AuditLogsController, DataChangesController],
	providers: [
		{
			provide: AUDIT_READ_SESSION,
			inject: [TenantTransactionService, AuditTrailService],
			useFactory: (transactions: TenantTransactionService, auditTrail: AuditTrailService): AuditReadSession => new PrismaAuditReadSession(transactions, auditTrail),
		},
		ListHttpAuditLogsHandler,
		GetHttpAuditLogHandler,
		ListDataChangesHandler,
		GetDataChangeHandler,
		ListAuditTrailHandler,
		{
			provide: AUDIT_RETENTION,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): AuditRetentionPort => new PrismaAuditRetentionAdapter(transactions),
		},
		PurgeExpiredAuditRecordsHandler,
		AuditRecordRetentionCron,
		PgAuditTrailSignals,
		{ provide: AUDIT_TRAIL_SIGNALS, useExisting: PgAuditTrailSignals },
		{
			provide: AUDIT_TRAIL_LISTEN_CONNECTION,
			inject: [TypedConfigService],
			useFactory:
				(config: TypedConfigService): OpenListenConnection =>
				(): PgListenConnection =>
					new PgListenConnection(config.database.sessionUrl, "audit-trail-listener"),
		},
	],
})
export class AuditModule {}
