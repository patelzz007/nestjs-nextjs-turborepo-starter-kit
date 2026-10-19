import { Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { REWARD_CODE_HASHER_PROVIDER } from "../../platform/infrastructure/crypto/reward-code-hasher.provider";
import { RewardCodeHasher } from "../../platform/infrastructure/crypto/reward-code-hasher";
import { OutboxModule } from "../../platform/infrastructure/outbox/outbox.module";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
// Claims are a customer's own rows (`reward_user` RLS): no organization is needed; merchants' requests carry theirs.
import { USER_OWNED_DATA_SCOPE } from "../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { getApiConfig } from "../../config/api-config";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { NotificationsModule, NotificationsTransactionalPortsFactory } from "../notifications/public-api";
import { OrganizationAccessModule } from "../organizations/public-api";
import type { ClaimsScope } from "./application/claims-scope";
import { ClaimRewardHandler } from "./application/commands/claim-reward/claim-reward.handler";
import { ExpireOverdueClaimsHandler } from "./application/commands/expire-overdue-claims/expire-overdue-claims.handler";
import { ExpireOverdueReferrerClaimsHandler } from "./application/commands/expire-overdue-referrer-claims/expire-overdue-referrer-claims.handler";
import { IssueClaimQrCodesHandler } from "./application/commands/issue-claim-qr-codes/issue-claim-qr-codes.handler";
import { MarkRewardNotificationsReadHandler } from "./application/commands/mark-reward-notifications-read/mark-reward-notifications-read.handler";
import { RequestClaimOtpHandler } from "./application/commands/request-claim-otp/request-claim-otp.handler";
import { SweepReferrerCreditEmailsHandler } from "./application/commands/sweep-referrer-credit-emails/sweep-referrer-credit-emails.handler";
import { SweepSignupSuccessNoticesHandler } from "./application/commands/sweep-signup-success-notices/sweep-signup-success-notices.handler";
import { DeliverSignupSuccessNoticeOnSignupReferralSucceeded } from "./application/event-handlers/after-commit/deliver-signup-success-notice.event-handler";
import { RequestReferrerCreditEmailOnReferrerCredited } from "./application/event-handlers/after-commit/request-referrer-credit-email.event-handler";
import type { ClaimCodesPort } from "./application/ports/claim-codes.port";
import type { ClaimReadPort, RewardNotificationReadPort } from "./application/ports/claims-read.port";
import { CLAIM_CODES, CLAIM_ID_GENERATOR, CLAIM_READS, CLAIMS_UNIT_OF_WORK, REWARD_NOTIFICATION_READS } from "./application/ports/claims.tokens";
import { GetMyClaimHandler } from "./application/queries/get-my-claim/get-my-claim.handler";
import { ListMyClaimsHandler } from "./application/queries/list-my-claims/list-my-claims.handler";
import { ListMyRewardNotificationsHandler } from "./application/queries/list-my-reward-notifications/list-my-reward-notifications.handler";
import { ClaimCodesAdapter } from "./infrastructure/adapters/claim-codes.adapter";
import { UuidClaimIdGenerator } from "./infrastructure/adapters/uuid-claim-id.generator";
import { ClaimsRegistrations } from "./infrastructure/claims-registrations";
import { ClaimsQueueModule } from "./infrastructure/queue/claims-queue.module";
import { ClaimsScopeFactory } from "./infrastructure/persistence/claims-scope.factory";
import { PrismaClaimReadRepository, PrismaRewardNotificationReadRepository } from "./infrastructure/persistence/prisma-claims.read-repository";
import { ConsumerClaimsController } from "./presentation/http/consumer-claims.controller";
import { RewardNotificationsController } from "./presentation/http/reward-notifications.controller";
import { SignupSuccessNoticesCron } from "./presentation/jobs/signup-success-notices.cron";

// Queue wiring is decided at load time from the validated config (parsed by main.ts first).
const claimsQueueImports = getApiConfig().messaging.redisUrl !== undefined ? [ClaimsQueueModule] : [];

/**
 * The claims context: a customer's claim of a reward (OTP, the claim with its stock reservation, the
 * wallet reads and the QR codes), their reward inbox, the notices other contexts' events write (a
 * referrer's signup-success notice included), and a credited referrer's credit claim and email.
 * A composition module (it binds rewards', identity's and referrals' transactional ports to its
 * transaction), mounted by `app.module.ts` only.
 */
@Module({
	imports: [PrismaModule, OutboxModule, UnitOfWorkModule, SystemCommandModule, NotificationsModule, OrganizationAccessModule, ...claimsQueueImports],
	controllers: [ConsumerClaimsController, RewardNotificationsController],
	providers: [
		{
			provide: CLAIMS_UNIT_OF_WORK,
			inject: [TenantTransactionService, NotificationsTransactionalPortsFactory, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				notifications: NotificationsTransactionalPortsFactory,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<ClaimsScope> => new PrismaUnitOfWork(transactions, new ClaimsScopeFactory(notifications), dispatcher, publisher, USER_OWNED_DATA_SCOPE),
		},
		{
			provide: CLAIM_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): ClaimReadPort =>
				new PrismaClaimReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions, USER_OWNED_DATA_SCOPE)),
		},
		{
			provide: REWARD_NOTIFICATION_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): RewardNotificationReadPort =>
				new PrismaRewardNotificationReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions, USER_OWNED_DATA_SCOPE)),
		},
		REWARD_CODE_HASHER_PROVIDER,
		{ provide: CLAIM_CODES, inject: [RewardCodeHasher], useFactory: (hasher: RewardCodeHasher): ClaimCodesPort => new ClaimCodesAdapter(hasher) },
		UuidClaimIdGenerator,
		{ provide: CLAIM_ID_GENERATOR, useExisting: UuidClaimIdGenerator },
		ClaimsRegistrations,
		RequestClaimOtpHandler,
		ClaimRewardHandler,
		IssueClaimQrCodesHandler,
		MarkRewardNotificationsReadHandler,
		ExpireOverdueClaimsHandler,
		ExpireOverdueReferrerClaimsHandler,
		SweepReferrerCreditEmailsHandler,
		RequestReferrerCreditEmailOnReferrerCredited,
		SweepSignupSuccessNoticesHandler,
		DeliverSignupSuccessNoticeOnSignupReferralSucceeded,
		SignupSuccessNoticesCron,
		ListMyClaimsHandler,
		GetMyClaimHandler,
		ListMyRewardNotificationsHandler,
	],
})
export class ClaimsModule {}
