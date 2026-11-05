import { Module, type OnModuleInit } from "@nestjs/common";

import { CLOCK, type Clock } from "../../platform/application/clock.port";
import { PersonalDataErasureRegistry } from "../../platform/application/personal-data/personal-data-erasure.registry";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { SAVED_LIST_VIEW_STORE, SAVED_VIEWS_SERVICE, type SavedListViewStore } from "./application/ports/saved-list-view.store";
import { SavedViewsService } from "./application/services/saved-views.service";
import { PrismaSavedListViewStore } from "./infrastructure/persistence/prisma-saved-list-view.store";
import { savedViewsEraser } from "./infrastructure/persistence/saved-views-erasure";
import { SavedViewsController } from "./presentation/http/saved-views.controller";

/** Saved views on admin lists (enhancement 5.10). Imports no other context. */
@Module({
	controllers: [SavedViewsController],
	providers: [
		{
			provide: SAVED_LIST_VIEW_STORE,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): SavedListViewStore => new PrismaSavedListViewStore(transactions),
		},
		{
			provide: SAVED_VIEWS_SERVICE,
			inject: [SAVED_LIST_VIEW_STORE, CLOCK],
			useFactory: (store: SavedListViewStore, clock: Clock): SavedViewsService => new SavedViewsService(store, clock),
		},
	],
})
export class SavedViewsModule implements OnModuleInit {
	public constructor(
		private readonly erasure: PersonalDataErasureRegistry,
		private readonly erasureTransactions: TenantTransactionService,
	) {}

	/** Registers this context's part of account erasure (ADR 077). */
	public onModuleInit(): void {
		this.erasure.registerEraser(savedViewsEraser(this.erasureTransactions));
	}
}
