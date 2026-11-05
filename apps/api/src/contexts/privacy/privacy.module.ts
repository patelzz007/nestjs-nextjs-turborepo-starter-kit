import { Module } from "@nestjs/common";
import { newRowId } from "@workspace/shared";

import { CLOCK, type Clock } from "../../platform/application/clock.port";
import { PersonalDataErasureRegistry } from "../../platform/application/personal-data/personal-data-erasure.registry";
import { AuditTrailService } from "../../platform/infrastructure/audit/audit-trail.service";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { CompleteDueErasuresHandler } from "./application/commands/complete-due-erasures/complete-due-erasures.handler";
import { ACCOUNT_ERASURE_SERVICE, ACCOUNT_ERASURE_STORE, type AccountErasureStore } from "./application/ports/account-erasure.store";
import { AccountErasureService } from "./application/services/account-erasure.service";
import { PrismaAccountErasureStore } from "./infrastructure/persistence/prisma-account-erasure.store";
import { AccountErasureController } from "./presentation/http/account-erasure.controller";
import { AdminAccountErasureController } from "./presentation/http/admin-account-erasure.controller";
import { AccountErasureCron } from "./presentation/jobs/account-erasure.cron";
import { PERSONAL_DATA_ARCHIVE, PERSONAL_DATA_EXPORT_AUDIT, type PersonalDataExportAuditPort } from "./application/ports/personal-data-export.ports";
import { ExportPersonalDataHandler } from "./application/queries/export-personal-data/export-personal-data.handler";
import { AuditTrailPersonalDataExportAdapter } from "./infrastructure/adapters/audit-trail-personal-data-export.adapter";
import { ZipPersonalDataArchiveAdapter } from "./infrastructure/adapters/zip-personal-data-archive.adapter";
import { PersonalDataController } from "./presentation/http/personal-data.controller";

/**
 * A person's rights over their data (ADR 077): "Download my data" and "Delete my account". Both assemble what
 * every context registered in the platform personal-data registries; this context imports no other context.
 */
@Module({
	imports: [SystemCommandModule],
	controllers: [PersonalDataController, AccountErasureController, AdminAccountErasureController],
	providers: [
		ExportPersonalDataHandler,
		{
			provide: ACCOUNT_ERASURE_STORE,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): AccountErasureStore => new PrismaAccountErasureStore(transactions),
		},
		{
			provide: ACCOUNT_ERASURE_SERVICE,
			inject: [ACCOUNT_ERASURE_STORE, PersonalDataErasureRegistry, CLOCK],
			useFactory: (store: AccountErasureStore, registry: PersonalDataErasureRegistry, clock: Clock): AccountErasureService =>
				new AccountErasureService({ store, registry, clock, ids: { next: newRowId } }),
		},
		CompleteDueErasuresHandler,
		AccountErasureCron,
		{ provide: PERSONAL_DATA_ARCHIVE, useClass: ZipPersonalDataArchiveAdapter },
		{
			provide: PERSONAL_DATA_EXPORT_AUDIT,
			inject: [AuditTrailService],
			useFactory: (auditTrail: AuditTrailService): PersonalDataExportAuditPort => new AuditTrailPersonalDataExportAdapter(auditTrail),
		},
	],
})
export class PrivacyModule {}
