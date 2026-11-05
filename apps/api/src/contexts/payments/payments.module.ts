import { Module, type OnModuleInit } from "@nestjs/common";
import { PersonalDataErasureRegistry } from "../../platform/application/personal-data/personal-data-erasure.registry";
import { pendingPaymentBlocker } from "./infrastructure/personal-data/payments-erasure";
import type { Prisma } from "@prisma/client";

import { TypedConfigService } from "../../config/typed-config.service";
import { CLOCK, type Clock } from "../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { MERCHANT_ACCESS, TenantAccessModule } from "../tenancy/public-api";
import { ReconcilePaymentsHandler } from "./application/commands/reconcile-payments/reconcile-payments.handler";
import type { PaymentsScope } from "./application/payments-scope";
import {
	PAYMENT_CALLBACK_RECEPTION,
	PAYMENT_CALLBACK_VERIFIERS,
	PAYMENT_IDS,
	PAYMENT_PROVIDERS,
	PAYMENTS_SERVICE,
	PAYMENTS_UNIT_OF_WORK,
} from "./application/payments.tokens";
import { PaymentCallbackReception } from "./application/services/payment-callback-reception";
import type { PaymentIdsPort } from "./application/ports/payment-ids.port";
import type { PaymentProvidersPort } from "./application/ports/payment-providers.port";
import { PaymentsService } from "./application/services/payments.service";
import { PaymentIdsAdapter } from "./infrastructure/adapters/payment-ids.adapter";
import { PaymentsScopeFactory } from "./infrastructure/persistence/payments-scope.factory";
import { ConfiguredPaymentProviders } from "./infrastructure/providers/payment-providers.registry";
import { PaymentCallbacksController } from "./presentation/http/payment-callbacks.controller";
import { TenantPaymentsController } from "./presentation/http/tenant-payments.controller";
import { PaymentReconciliationCron } from "./presentation/jobs/payment-reconciliation.cron";
import { WebhooksInboundModule } from "../webhooks/inbound/public-api";

/** Payments through Billplz, CHIP or the fake gateway (ADR 020). */
@Module({
	imports: [PrismaModule, UnitOfWorkModule, SystemCommandModule, TenantAccessModule, WebhooksInboundModule],
	controllers: [TenantPaymentsController, PaymentCallbacksController],
	providers: [
		{
			provide: PAYMENTS_UNIT_OF_WORK,
			inject: [TenantTransactionService, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<PaymentsScope> => new PrismaUnitOfWork(transactions, new PaymentsScopeFactory(), dispatcher, publisher),
		},
		{
			provide: PAYMENT_PROVIDERS,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): PaymentProvidersPort => new ConfiguredPaymentProviders(config.payments),
		},
		{ provide: PAYMENT_IDS, useClass: PaymentIdsAdapter },
		{
			provide: PAYMENTS_SERVICE,
			inject: [PAYMENTS_UNIT_OF_WORK, PAYMENT_PROVIDERS, MERCHANT_ACCESS, PAYMENT_IDS, CLOCK, TypedConfigService],
			useFactory: (
				uow: UnitOfWork<PaymentsScope>,
				providers: PaymentProvidersPort,
				merchantAccess: MerchantAccessPort,
				ids: PaymentIdsPort,
				clock: Clock,
				config: TypedConfigService,
			): PaymentsService =>
				new PaymentsService({
					uow,
					providers,
					merchantAccess,
					ids,
					clock,
					returnOrigins: [config.clientApps.webUrl, config.clientApps.adminUrl, config.clientApps.merchantUrl].map((url: string): string => new URL(url).origin),
					apiPublicUrl: config.http.publicUrl,
				}),
		},
		// The same ConfiguredPaymentProviders instance also holds each gateway's callback verifier (ADR 081).
		{ provide: PAYMENT_CALLBACK_VERIFIERS, useExisting: PAYMENT_PROVIDERS },
		PaymentCallbackReception,
		{ provide: PAYMENT_CALLBACK_RECEPTION, useExisting: PaymentCallbackReception },
		ReconcilePaymentsHandler,
		PaymentReconciliationCron,
	],
})
export class PaymentsModule implements OnModuleInit {
	public constructor(
		private readonly erasure: PersonalDataErasureRegistry,
		private readonly erasureTransactions: TenantTransactionService,
	) {}

	/** Registers this context's part of account erasure (ADR 077). */
	public onModuleInit(): void {
		this.erasure.registerBlocker(pendingPaymentBlocker(this.erasureTransactions));
	}
}
