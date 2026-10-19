import { Module, type OnModuleInit, type Provider } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { getApiConfig } from "../../config/api-config";
import { PublicUrlResolver } from "../../config/public-url.resolver";
import { bindInTransactionHandler } from "../../platform/application/events/in-transaction-event-handler";
import { InTransactionEventRegistry } from "../../platform/application/events/in-transaction-event-registry";
import { IntegrationEventMapperRegistry } from "../../platform/application/events/integration-event-mapper";
import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
// A customer accepts the legal terms with no organization; merchant work carries the one its URL names. RLS is the guard.
import { USER_OWNED_DATA_SCOPE } from "../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { StoredFileAccess, FilesModule } from "../files/public-api";
import { ORGANIZATION_READ, OrganizationAccessModule, type OrganizationReadPort } from "../organizations/public-api";
import { AcceptLegalTermsHandler } from "./application/commands/accept-legal-terms/accept-legal-terms.handler";
import { ApproveRewardHandler } from "./application/commands/approve-reward/approve-reward.handler";
import { AutoPublishDueRewardsHandler } from "./application/commands/auto-publish-due-rewards/auto-publish-due-rewards.handler";
import { CreateRewardHandler } from "./application/commands/create-reward/create-reward.handler";
import { RejectRewardHandler } from "./application/commands/reject-reward/reject-reward.handler";
import { ReviseRewardHandler } from "./application/commands/revise-reward/revise-reward.handler";
import { SubmitRewardForReviewHandler } from "./application/commands/submit-reward-for-review/submit-reward-for-review.handler";
import { RecordRewardReviewAuditHandler } from "./application/event-handlers/in-transaction/record-reward-review-audit.in-transaction-handler";
import type { LegalAcceptanceReadPort, RewardImageDeliveryPort, RewardReadPort } from "./application/ports/reward-read.port";
import { LEGAL_ACCEPTANCE_READS, REWARD_ID_GENERATOR, REWARD_IMAGE_DELIVERY, REWARD_READS, REWARDS_UNIT_OF_WORK, type IdGenerator } from "./application/ports/rewards.tokens";
import { GetLegalAcceptanceStatusHandler } from "./application/queries/get-legal-acceptance-status/get-legal-acceptance-status.handler";
import { GetOrganizationRewardHandler } from "./application/queries/get-organization-reward/get-organization-reward.handler";
import { GetPublishedRewardHandler } from "./application/queries/get-published-reward/get-published-reward.handler";
import { GetRewardForAdminHandler } from "./application/queries/get-reward-for-admin/get-reward-for-admin.handler";
import { GetRewardImageDownloadUrlHandler } from "./application/queries/get-reward-image-download-url/get-reward-image-download-url.handler";
import { GetRewardImagesArchiveHandler } from "./application/queries/get-reward-images-archive/get-reward-images-archive.handler";
import { ListMarketplaceRewardsHandler } from "./application/queries/list-marketplace-rewards/list-marketplace-rewards.handler";
import { ListOrganizationRewardsHandler } from "./application/queries/list-organization-rewards/list-organization-rewards.handler";
import { SummarizeOrganizationRewardsHandler } from "./application/queries/summarize-organization-rewards/summarize-organization-rewards.handler";
import { ListRewardsPendingReviewHandler } from "./application/queries/list-rewards-pending-review/list-rewards-pending-review.handler";
import type { RewardsScope } from "./application/rewards-scope";
import { RewardImageDeliveryAdapter } from "./infrastructure/adapters/reward-image-delivery.adapter";
import { UuidIdGenerator } from "./infrastructure/adapters/uuid-id-generator";
import { RewardsQueueModule } from "./infrastructure/queue/rewards-queue.module";
import { RewardsIntegrationEventsMapper } from "./infrastructure/outbox/rewards-integration-events.mapper";
import { OrganizationDisplayAdapter } from "./infrastructure/adapters/organization-display.adapter";
import { RewardsFileRegistrations } from "./infrastructure/persistence/rewards-file-registrations";
import { PrismaLegalAcceptanceReadRepository } from "./infrastructure/persistence/prisma-legal-acceptance.read-repository";
import { PrismaRewardReadRepository } from "./infrastructure/persistence/prisma-reward.read-repository";
import { RewardsReadSession } from "./infrastructure/persistence/rewards-read-session";
import { RewardsScopeFactory } from "./infrastructure/persistence/rewards-scope.factory";
import { RewardsAdminRewardsController } from "./presentation/http/admin-rewards.controller";
import { ConsumerRewardsController } from "./presentation/http/consumer-rewards.controller";
import { OrganizationRewardsController } from "./presentation/http/organization-rewards.controller";
import { RewardLegalController } from "./presentation/http/reward-legal.controller";

// Queue workers run only when Redis is configured (decided at load time from the validated config).
const rewardsQueueImports = getApiConfig().messaging.redisUrl !== undefined ? [RewardsQueueModule] : [];

const COMMAND_HANDLERS: readonly Provider[] = [
	CreateRewardHandler,
	ReviseRewardHandler,
	SubmitRewardForReviewHandler,
	ApproveRewardHandler,
	RejectRewardHandler,
	AutoPublishDueRewardsHandler,
	AcceptLegalTermsHandler,
];

const QUERY_HANDLERS: readonly Provider[] = [
	ListOrganizationRewardsHandler,
	SummarizeOrganizationRewardsHandler,
	GetOrganizationRewardHandler,
	ListRewardsPendingReviewHandler,
	GetRewardForAdminHandler,
	GetRewardImageDownloadUrlHandler,
	GetRewardImagesArchiveHandler,
	ListMarketplaceRewardsHandler,
	GetPublishedRewardHandler,
	GetLegalAcceptanceStatusHandler,
];

/**
 * The rewards context: defining offers (the Reward aggregate with its referrer child), merchant
 * edits, admin review, auto-publish, marketplace reads and legal acceptance (plan §7.1).
 */
@Module({
	imports: [PrismaModule, UnitOfWorkModule, SystemCommandModule, OrganizationAccessModule, FilesModule, ...rewardsQueueImports],
	controllers: [OrganizationRewardsController, RewardsAdminRewardsController, ConsumerRewardsController, RewardLegalController],
	providers: [
		PublicUrlResolver,
		RewardsScopeFactory,
		{
			provide: REWARDS_UNIT_OF_WORK,
			inject: [TenantTransactionService, RewardsScopeFactory, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				scopes: RewardsScopeFactory,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<RewardsScope> => new PrismaUnitOfWork(transactions, scopes, dispatcher, publisher, USER_OWNED_DATA_SCOPE),
		},
		{
			provide: RewardsReadSession,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): RewardsReadSession => new RewardsReadSession(transactions),
		},
		{
			provide: REWARD_READS,
			inject: [RewardsReadSession, ORGANIZATION_READ, PublicUrlResolver],
			useFactory: (session: RewardsReadSession, organizations: OrganizationReadPort, publicUrls: PublicUrlResolver): RewardReadPort =>
				new PrismaRewardReadRepository(session, new OrganizationDisplayAdapter(organizations), publicUrls.resolve),
		},
		{
			provide: REWARD_IMAGE_DELIVERY,
			inject: [RewardsReadSession, StoredFileAccess],
			useFactory: (session: RewardsReadSession, files: StoredFileAccess): RewardImageDeliveryPort => new RewardImageDeliveryAdapter(session, files),
		},
		{
			provide: LEGAL_ACCEPTANCE_READS,
			inject: [RewardsReadSession],
			useFactory: (session: RewardsReadSession): LegalAcceptanceReadPort => new PrismaLegalAcceptanceReadRepository(session),
		},
		{ provide: REWARD_ID_GENERATOR, useFactory: (): IdGenerator => new UuidIdGenerator() },
		RewardsFileRegistrations,
		...COMMAND_HANDLERS,
		...QUERY_HANDLERS,
	],
	exports: [REWARDS_UNIT_OF_WORK, RewardsScopeFactory],
})
export class RewardsModule implements OnModuleInit {
	public constructor(
		private readonly inTransactionHandlers: InTransactionEventRegistry<Prisma.TransactionClient>,
		private readonly mappers: IntegrationEventMapperRegistry,
		private readonly scopes: RewardsScopeFactory,
	) {}

	/** Registers the review-decision audit row (M1) and the `reward.platform` outbox mapper (M3). */
	public onModuleInit(): void {
		this.inTransactionHandlers.register(bindInTransactionHandler(new RecordRewardReviewAuditHandler(), this.scopes));
		this.mappers.register(new RewardsIntegrationEventsMapper());
	}
}
