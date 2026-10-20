import { Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { AuditTrailService } from "../../platform/infrastructure/audit/audit-trail.service";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { USER_OWNED_DATA_SCOPE } from "../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import type { GeographyReadPort } from "./application/ports/geography-read.port";
import { GEOGRAPHY_READ, REFERENCE_DATA_UNIT_OF_WORK } from "./application/ports/reference-data.tokens";
import type { ReferenceDataScope } from "./application/reference-data-scope";
import { GeographyApplicationService } from "./application/services/geography.application-service";
import { PrismaGeographyReadRepository } from "./infrastructure/persistence/prisma-geography.read-repository";
import { ReferenceDataScopeFactory } from "./infrastructure/persistence/reference-data-scope.factory";
import { GeoController } from "./presentation/http/geo.controller";

/**
 * Reference data: the geography hierarchy (regions, subregions, countries,
 * states, cities) on the simple application-service path (plan §4.4). The
 * global `AuditLogModule` provides `AuditTrailService` (the in-transaction
 * request audit); `SystemCommandModule` provides the clock.
 */
@Module({
	imports: [PrismaModule, UnitOfWorkModule, SystemCommandModule],
	controllers: [GeoController],
	providers: [
		{
			provide: REFERENCE_DATA_UNIT_OF_WORK,
			inject: [TenantTransactionService, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER, AuditTrailService],
			useFactory: (
				transactions: TenantTransactionService,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
				auditTrail: AuditTrailService,
			): UnitOfWork<ReferenceDataScope> => new PrismaUnitOfWork(transactions, new ReferenceDataScopeFactory(auditTrail), dispatcher, publisher),
		},
		{
			provide: GEOGRAPHY_READ,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): GeographyReadPort =>
				new PrismaGeographyReadRepository(new PrismaReadExecutor(transactions, USER_OWNED_DATA_SCOPE)),
		},
		GeographyApplicationService,
	],
})
export class ReferenceDataModule {}
