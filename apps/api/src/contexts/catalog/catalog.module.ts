import { Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { PrismaModule } from "../../prisma/prisma.module";
import { FilesModule } from "../files/public-api";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import type { CatalogScope } from "./application/catalog-scope";
import { CATALOG_UNIT_OF_WORK } from "./application/catalog.tokens";
import { ProductApplicationService } from "./application/services/product.application-service";
import { SampleCategoryApplicationService } from "./application/services/sample-category.application-service";
import { CatalogFileRegistrations } from "./infrastructure/persistence/catalog-file-registrations";
import { CatalogScopeFactory } from "./infrastructure/persistence/catalog-scope.factory";
import { ProductController } from "./presentation/http/product.controller";
import { SampleCategoryController } from "./presentation/http/sample-category.controller";

@Module({
	imports: [PrismaModule, UnitOfWorkModule, FilesModule],
	controllers: [ProductController, SampleCategoryController],
	providers: [
		{
			provide: CATALOG_UNIT_OF_WORK,
			inject: [TenantTransactionService, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<CatalogScope> => new PrismaUnitOfWork(transactions, new CatalogScopeFactory(), dispatcher, publisher),
		},
		ProductApplicationService,
		SampleCategoryApplicationService,
		CatalogFileRegistrations,
	],
	exports: [ProductApplicationService, SampleCategoryApplicationService],
})
export class CatalogModule {}
