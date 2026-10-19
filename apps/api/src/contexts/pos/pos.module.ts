import { Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { RewardCodeHasher } from "../../platform/infrastructure/crypto/reward-code-hasher";
import { REWARD_CODE_HASHER_PROVIDER } from "../../platform/infrastructure/crypto/reward-code-hasher.provider";
import { OutboxModule } from "../../platform/infrastructure/outbox/outbox.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { OrganizationAccessModule } from "../organizations/public-api";
import { ChangePosSettingsHandler } from "./application/commands/change-pos-settings/change-pos-settings.handler";
import { CheckoutSaleHandler } from "./application/commands/checkout-sale/checkout-sale.handler";
import { IssueApiKeyHandler } from "./application/commands/issue-api-key/issue-api-key.handler";
import { IssuePairingCodeHandler } from "./application/commands/issue-pairing-code/issue-pairing-code.handler";
import { PairTerminalHandler } from "./application/commands/pair-terminal/pair-terminal.handler";
import { RegisterTerminalHandler } from "./application/commands/register-terminal/register-terminal.handler";
import { RemoveTerminalHandler } from "./application/commands/remove-terminal/remove-terminal.handler";
import { RevokeApiKeyHandler } from "./application/commands/revoke-api-key/revoke-api-key.handler";
import { ValidateRedemptionCodesHandler } from "./application/commands/validate-redemption-codes/validate-redemption-codes.handler";
import type { PosScope } from "./application/pos-scope";
import type { ApiKeyReadPort, RedemptionReadPort, TerminalReadPort } from "./application/ports/pos-read.port";
import { API_KEY_READS, CHECKOUT_FINGERPRINT, POS_CREDENTIALS, POS_ID_GENERATOR, POS_UNIT_OF_WORK, REDEMPTION_READS, TERMINAL_READS } from "./application/ports/pos.tokens";
import { GetPosSettingsHandler } from "./application/queries/get-pos-settings/get-pos-settings.handler";
import { GetTerminalSummaryHandler } from "./application/queries/get-terminal-summary/get-terminal-summary.handler";
import { GetTerminalHandler } from "./application/queries/get-terminal/get-terminal.handler";
import { ListApiKeysHandler } from "./application/queries/list-api-keys/list-api-keys.handler";
import { ListOrganizationRedemptionsHandler } from "./application/queries/list-organization-redemptions/list-organization-redemptions.handler";
import { ListTerminalsHandler } from "./application/queries/list-terminals/list-terminals.handler";
import { RedemptionCodeResolver } from "./application/services/redemption-code-resolver";
import { Sha256CheckoutFingerprint } from "./infrastructure/adapters/checkout-fingerprint.adapter";
import { PosCredentialsAdapter } from "./infrastructure/adapters/pos-credentials.adapter";
import { UuidPosIdGenerator } from "./infrastructure/adapters/uuid-pos-id.generator";
import { PosScopeFactory } from "./infrastructure/persistence/pos-scope.factory";
import { PrismaApiKeyReadRepository, PrismaRedemptionReadRepository, PrismaTerminalReadRepository } from "./infrastructure/persistence/prisma-pos.read-repositories";
import { PosRegistrations } from "./infrastructure/pos-registrations";
import { MerchantApiKeyGuard } from "../../platform/presentation/http/security/guards/merchant-api-key.guard";
import { PosRateLimitGuard } from "./presentation/http/guards/pos-rate-limit.guard";
import { OrganizationApiKeysController } from "./presentation/http/organization-api-keys.controller";
import { OrganizationRedemptionsController } from "./presentation/http/organization-redemptions.controller";
import { OrganizationTerminalsController, PosTerminalsController } from "./presentation/http/organization-terminals.controller";
import { RedemptionsController } from "./presentation/http/redemptions.controller";

/**
 * The pos context: checking out at a till (validate, checkout as one unit of work over claims, rewards
 * and referrals), the backup-code lockout, terminals and pairing, merchant API keys, and the
 * organization's redemption history. A composition module (it binds other contexts' transactional
 * ports to its transaction), mounted by `app.module.ts` only; `PosAccessModule` is its global leaf.
 */
@Module({
	imports: [PrismaModule, OutboxModule, UnitOfWorkModule, OrganizationAccessModule],
	controllers: [RedemptionsController, OrganizationTerminalsController, PosTerminalsController, OrganizationApiKeysController, OrganizationRedemptionsController],
	providers: [
		REWARD_CODE_HASHER_PROVIDER,
		{
			provide: POS_UNIT_OF_WORK,
			inject: [TenantTransactionService, RewardCodeHasher, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				codeHasher: RewardCodeHasher,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<PosScope> => new PrismaUnitOfWork(transactions, new PosScopeFactory(codeHasher), dispatcher, publisher),
		},
		{
			provide: TERMINAL_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): TerminalReadPort =>
				new PrismaTerminalReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions)),
		},
		{
			provide: API_KEY_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): ApiKeyReadPort => new PrismaApiKeyReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions)),
		},
		{
			provide: REDEMPTION_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): RedemptionReadPort =>
				new PrismaRedemptionReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions)),
		},
		PosCredentialsAdapter,
		{ provide: POS_CREDENTIALS, useExisting: PosCredentialsAdapter },
		UuidPosIdGenerator,
		{ provide: POS_ID_GENERATOR, useExisting: UuidPosIdGenerator },
		Sha256CheckoutFingerprint,
		{ provide: CHECKOUT_FINGERPRINT, useExisting: Sha256CheckoutFingerprint },
		MerchantApiKeyGuard,
		PosRateLimitGuard,
		PosRegistrations,
		RedemptionCodeResolver,
		ValidateRedemptionCodesHandler,
		CheckoutSaleHandler,
		RegisterTerminalHandler,
		IssuePairingCodeHandler,
		RemoveTerminalHandler,
		PairTerminalHandler,
		ChangePosSettingsHandler,
		IssueApiKeyHandler,
		RevokeApiKeyHandler,
		ListTerminalsHandler,
		GetTerminalSummaryHandler,
		GetTerminalHandler,
		GetPosSettingsHandler,
		ListApiKeysHandler,
		ListOrganizationRedemptionsHandler,
	],
})
export class PosModule {}
