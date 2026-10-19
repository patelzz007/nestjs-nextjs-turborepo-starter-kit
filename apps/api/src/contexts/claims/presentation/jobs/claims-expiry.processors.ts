import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import { QUEUE_NAMES, RewardsMaintenanceJobSchema } from "@workspace/shared";
import type { Job } from "bullmq";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { ExpireOverdueClaimsCommand } from "../../application/commands/expire-overdue-claims/expire-overdue-claims.command";
import { ExpireOverdueReferrerClaimsCommand } from "../../application/commands/expire-overdue-referrer-claims/expire-overdue-referrer-claims.command";
import type { ClaimExpiryResult } from "../../application/services/claim-expiry.application-service";

/** `claims.expire-pending` → ExpireOverdueClaims, audited by the dispatcher; a failure rethrows so BullMQ retries. */
@Processor(QUEUE_NAMES.claimsExpirePending)
@Injectable()
export class ClaimsExpirePendingProcessor extends WorkerHost {
	public constructor(@Inject(SystemCommandDispatcher) private readonly commands: Pick<SystemCommandDispatcher, "dispatch">) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<ClaimExpiryResult> {
		RewardsMaintenanceJobSchema.parse(job.data);
		const actor = systemActor("queue.claims.expire_pending", "job", null, "Expire overdue consumer reward claims", null);
		return this.commands.dispatch(new ExpireOverdueClaimsCommand(actor), { kind: "job", name: QUEUE_NAMES.claimsExpirePending });
	}
}

/** `claims.expire-referrer` → ExpireOverdueReferrerClaims, the referrer-credit claims on their own queue. */
@Processor(QUEUE_NAMES.claimsExpireReferrer)
@Injectable()
export class ClaimsExpireReferrerProcessor extends WorkerHost {
	public constructor(@Inject(SystemCommandDispatcher) private readonly commands: Pick<SystemCommandDispatcher, "dispatch">) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<ClaimExpiryResult> {
		RewardsMaintenanceJobSchema.parse(job.data);
		const actor = systemActor("queue.claims.expire_referrer", "job", null, "Expire overdue referrer-credit reward claims", null);
		return this.commands.dispatch(new ExpireOverdueReferrerClaimsCommand(actor), { kind: "job", name: QUEUE_NAMES.claimsExpireReferrer });
	}
}
