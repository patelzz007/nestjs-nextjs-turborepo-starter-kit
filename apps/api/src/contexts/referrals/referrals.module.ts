import { Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { MaintainSignupReferralCodesHandler } from "./application/commands/maintain-signup-referral-codes/maintain-signup-referral-codes.handler";
import type { SignupReferralCodeMaintenancePort } from "./application/ports/signup-referral-maintenance.port";
import type { SignupReferralReadPort } from "./application/ports/signup-referral-read.port";
import { SIGNUP_REFERRAL_AUDIT_FACTORY, SIGNUP_REFERRAL_CODE_MAINTENANCE, SIGNUP_REFERRAL_READS, SIGNUP_REFERRALS } from "./application/ports/referrals.tokens";
import { GetMySignupReferralDashboardHandler } from "./application/queries/get-my-signup-referral-dashboard/get-my-signup-referral-dashboard.handler";
import { ListMyRefereesHandler } from "./application/queries/list-my-referees/list-my-referees.handler";
import { SignupReferralApplicationService } from "./application/services/signup-referral.application-service";
import { PrismaSignupReferralCodeMaintenance, type SignupReferralAuditFactory } from "./infrastructure/persistence/prisma-signup-referral-jobs";
import { PrismaSignupReferralReadRepository } from "./infrastructure/persistence/prisma-signup-referral.read-repository";
import { SignupReferralController } from "./presentation/http/signup-referral.controller";
import { SignupReferralMaintenanceCron } from "./presentation/jobs/signup-referral-maintenance.cron";

/**
 * The referrals context (§6.1): signup referral codes and signup referrals (ADR 035). A leaf module:
 * it depends on platform only, so identity (signup) and the checkout can import it without a cycle.
 * Reward-referral crediting runs in the pos checkout's transaction (`createReferralCreditPort`). The
 * code job's audit writer arrives by token from rewards (`SIGNUP_REFERRAL_AUDIT_FACTORY`); claims
 * delivers the signup-success notice.
 */
@Module({
	imports: [PrismaModule, SystemCommandModule],
	controllers: [SignupReferralController],
	providers: [
		{
			provide: SIGNUP_REFERRAL_READS,
			inject: [TenantTransactionService, PrismaService],
			useFactory: (transactions: TenantTransactionService, prisma: PrismaService): SignupReferralReadPort =>
				new PrismaSignupReferralReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions), transactions, prisma),
		},
		{
			provide: SIGNUP_REFERRAL_CODE_MAINTENANCE,
			inject: [TenantTransactionService, SIGNUP_REFERRAL_AUDIT_FACTORY],
			useFactory: (transactions: TenantTransactionService, audit: SignupReferralAuditFactory): SignupReferralCodeMaintenancePort =>
				new PrismaSignupReferralCodeMaintenance(transactions, audit),
		},
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
