import { Module } from "@nestjs/common";

import { SystemCommandModule } from "../../../../platform/infrastructure/system-command.module";
import { ClaimsExpirePendingProcessor, ClaimsExpireReferrerProcessor } from "../../presentation/jobs/claims-expiry.processors";
import { ReferrerCreditEmailsProcessor } from "../../presentation/jobs/referrer-credit-emails.processor";
import { ClaimsExpiryScheduler } from "./claims-expiry.scheduler";

/** The claim-expiry and referrer-credit email BullMQ workers and their schedules; imported by the claims module only when Redis is configured. */
@Module({
	imports: [SystemCommandModule],
	providers: [ClaimsExpiryScheduler, ClaimsExpirePendingProcessor, ClaimsExpireReferrerProcessor, ReferrerCreditEmailsProcessor],
})
export class ClaimsQueueModule {}
