import type { Command } from "@nestjs/cqrs";
import { QUEUE_NAMES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { SystemCommandOrigin } from "../../../../../platform/application/ports/command-audit.port";
import type { SystemCommandDispatcher } from "../../../../../platform/application/system-command-dispatcher";
import { SweepReferrerCreditEmailsCommand } from "../../../application/commands/sweep-referrer-credit-emails/sweep-referrer-credit-emails.command";
import { ReferrerCreditEmailsProcessor } from "../referrer-credit-emails.processor";

/** Raised after the dispatch was recorded: BullMQ sees the rejection and retries. */
class JobFailed extends Error {}

class RecordingDispatcher implements Pick<SystemCommandDispatcher, "dispatch"> {
	public readonly dispatched: { readonly command: object; readonly origin: SystemCommandOrigin }[] = [];

	public dispatch<TResult>(command: Command<TResult>, origin: SystemCommandOrigin): Promise<TResult> {
		this.dispatched.push({ command, origin });
		return Promise.reject(new JobFailed());
	}
}

describe("ReferrerCreditEmailsProcessor", () => {
	it("dispatches the sweep as the queue's system operation, and rethrows a failure for BullMQ's retry", async () => {
		const dispatcher = new RecordingDispatcher();

		await expect(new ReferrerCreditEmailsProcessor(dispatcher).process({ data: {} })).rejects.toBeInstanceOf(JobFailed);

		expect(dispatcher.dispatched.map(({ command, origin }) => [command.constructor, origin])).toEqual([
			[SweepReferrerCreditEmailsCommand, { kind: "job", name: QUEUE_NAMES.rewardsReferralCreditNotify }],
		]);
		expect(dispatcher.dispatched.at(0)?.command).toMatchObject({ actor: { kind: "system", operation: "queue.rewards.referral_credit_notify", origin: "job" } });
	});
});
