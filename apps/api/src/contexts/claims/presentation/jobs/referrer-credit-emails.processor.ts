import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";
import type { Job } from "bullmq";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { SweepReferrerCreditEmailsCommand } from "../../application/commands/sweep-referrer-credit-emails/sweep-referrer-credit-emails.command";
import type { ReferrerCreditEmailSweep } from "../../application/services/referrer-credit-email.application-service";

/** `rewards.referral-credit-notify` → SweepReferrerCreditEmails, audited by the dispatcher; a failure rethrows so BullMQ retries. */
@Processor(QUEUE_NAMES.rewardsReferralCreditNotify)
@Injectable()
export class ReferrerCreditEmailsProcessor extends WorkerHost {
	public constructor(@Inject(SystemCommandDispatcher) private readonly commands: Pick<SystemCommandDispatcher, "dispatch">) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<ReferrerCreditEmailSweep> {
		RewardsMaintenanceJobSchema.parse(job.data);
		const actor = systemActor("queue.rewards.referral_credit_notify", "job", null, "Request owed referrer-credit emails", null);
		return this.commands.dispatch(new SweepReferrerCreditEmailsCommand(actor), { kind: "job", name: QUEUE_NAMES.rewardsReferralCreditNotify });
	}
}
