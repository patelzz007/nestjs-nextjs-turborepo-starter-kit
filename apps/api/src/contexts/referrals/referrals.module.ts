import { Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import { USER_OWNED_DATA_SCOPE } from "../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { CreateRewardReferralLinkHandler } from "./application/commands/create-reward-referral-link/create-reward-referral-link.handler";
import { RecordRewardReferralAttributionHandler } from "./application/commands/record-reward-referral-attribution/record-reward-referral-attribution.handler";
import { MaintainSignupReferralCodesHandler } from "./application/commands/maintain-signup-referral-codes/maintain-signup-referral-codes.handler";
import type { SignupReferralCodeMaintenancePort } from "./application/ports/signup-referral-maintenance.port";
import type { SignupReferralReadPort } from "./application/ports/signup-referral-read.port";
import type { RewardReferralLinkTransactions } from "./application/ports/reward-referral-links.port";
import {
	REFERABLE_REWARD_LOOKUP_FACTORY,
	REFEREE_ATTRIBUTION_FACTORY,
	REFERRAL_LINK_IDENTITY_GENERATOR,
	REWARD_REFERRAL_LINK_TRANSACTIONS,
	SIGNUP_REFERRAL_AUDIT_FACTORY,
	SIGNUP_REFERRAL_CODE_MAINTENANCE,
	SIGNUP_REFERRAL_READS,
	SIGNUP_REFERRALS,
} from "./application/ports/referrals.tokens";
import { GetMySignupReferralDashboardHandler } from "./application/queries/get-my-signup-referral-dashboard/get-my-signup-referral-dashboard.handler";
import { ListMyRefereesHandler } from "./application/queries/list-my-referees/list-my-referees.handler";
import { SignupReferralApplicationService } from "./application/services/signup-referral.application-service";
import { CryptoReferralLinkIdentityGenerator } from "./infrastructure/adapters/referral-link-identity.generator";
import {
	PrismaRewardReferralLinkTransactions,
	type ReferableRewardLookupFactory,
	type RefereeAttributionFactory,
} from "./infrastructure/persistence/prisma-reward-referral-links";
import { PrismaSignupReferralCodeMaintenance, type SignupReferralAuditFactory } from "./infrastructure/persistence/prisma-signup-referral-jobs";
import { PrismaSignupReferralReadRepository } from "./infrastructure/persistence/prisma-signup-referral.read-repository";
import { RewardReferralController } from "./presentation/http/reward-referral.controller";
import { SignupReferralController } from "./presentation/http/signup-referral.controller";
import { SignupReferralMaintenanceCron } from "./presentation/jobs/signup-referral-maintenance.cron";

/**
 * The referrals context (§6.1): signup referral codes and signup referrals (ADR 035). A leaf module:
 * it depends on platform only, so identity (signup) and the checkout can import it without a cycle.
 * Reward-referral links (a referrer's share link, the referee's pending attribution) are minted here;
 * crediting runs in the pos checkout's transaction (`createReferralCreditPort`). Rewards provides the
 * reward check (`REFERABLE_REWARD_LOOKUP_FACTORY`) and identity the attribution writer
 * (`REFEREE_ATTRIBUTION_FACTORY`), both by token, so referrals still imports no context. The
 * code job's audit writer arrives by token from rewards (`SIGNUP_REFERRAL_AUDIT_FACTORY`); claims
 * delivers the signup-success notice.
 */
@Module({
	imports: [PrismaModule, SystemCommandModule],
	controllers: [SignupReferralController, RewardReferralController],
	providers: [
		{
			provide: SIGNUP_REFERRAL_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): SignupReferralReadPort =>
				new PrismaSignupReferralReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions, USER_OWNED_DATA_SCOPE), transactions),
		},
		{
			provide: SIGNUP_REFERRAL_CODE_MAINTENANCE,
			inject: [TenantTransactionService, SIGNUP_REFERRAL_AUDIT_FACTORY],
			useFactory: (transactions: TenantTransactionService, audit: SignupReferralAuditFactory): SignupReferralCodeMaintenancePort =>
				new PrismaSignupReferralCodeMaintenance(transactions, audit),
		},
		{
			provide: REWARD_REFERRAL_LINK_TRANSACTIONS,
			inject: [TenantTransactionService, REFERABLE_REWARD_LOOKUP_FACTORY, REFEREE_ATTRIBUTION_FACTORY],
			useFactory: (transactions: TenantTransactionService, rewards: ReferableRewardLookupFactory, referees: RefereeAttributionFactory): RewardReferralLinkTransactions =>
				new PrismaRewardReferralLinkTransactions(transactions, rewards, referees),
		},
		{ provide: REFERRAL_LINK_IDENTITY_GENERATOR, useClass: CryptoReferralLinkIdentityGenerator },
		CreateRewardReferralLinkHandler,
		RecordRewardReferralAttributionHandler,
		SignupReferralApplicationService,
		{ provide: SIGNUP_REFERRALS, useExisting: SignupReferralApplicationService },
		GetMySignupReferralDashboardHandler,
		ListMyRefereesHandler,
		MaintainSignupReferralCodesHandler,
		SignupReferralMaintenanceCron,
	],
	exports: [SIGNUP_REFERRALS],
})
export class ReferralsModule {}
