import type { Command } from "@nestjs/cqrs";
import { QUEUE_NAMES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { SystemCommandOrigin } from "../../../../../platform/application/ports/command-audit.port";
import type { SystemCommandDispatcher } from "../../../../../platform/application/system-command-dispatcher";
import { ExpireOverdueClaimsCommand } from "../../../application/commands/expire-overdue-claims/expire-overdue-claims.command";
import { ExpireOverdueReferrerClaimsCommand } from "../../../application/commands/expire-overdue-referrer-claims/expire-overdue-referrer-claims.command";
import { ClaimsExpirePendingProcessor, ClaimsExpireReferrerProcessor } from "../claims-expiry.processors";

/** Raised after the dispatch was recorded: BullMQ sees the rejection and retries. */
class JobFailed extends Error {}

class RecordingDispatcher implements Pick<SystemCommandDispatcher, "dispatch"> {
	public readonly dispatched: { readonly command: object; readonly origin: SystemCommandOrigin }[] = [];

	public dispatch<TResult>(command: Command<TResult>, origin: SystemCommandOrigin): Promise<TResult> {
		this.dispatched.push({ command, origin });
		return Promise.reject(new JobFailed());
	}
}

describe("claim expiry processors", () => {
	it("dispatch their command as the queue's system operation, and rethrow a failure for BullMQ's retry", async () => {
		const dispatcher = new RecordingDispatcher();

		await expect(new ClaimsExpirePendingProcessor(dispatcher).process({ data: {} })).rejects.toBeInstanceOf(JobFailed);
		await expect(new ClaimsExpireReferrerProcessor(dispatcher).process({ data: {} })).rejects.toBeInstanceOf(JobFailed);

		expect(dispatcher.dispatched.map(({ command, origin }) => [command.constructor, origin])).toEqual([
			[ExpireOverdueClaimsCommand, { kind: "job", name: QUEUE_NAMES.claimsExpirePending }],
			[ExpireOverdueReferrerClaimsCommand, { kind: "job", name: QUEUE_NAMES.claimsExpireReferrer }],
		]);
		expect(dispatcher.dispatched.at(1)?.command).toMatchObject({ actor: { kind: "system", operation: "queue.claims.expire_referrer", origin: "job" } });
	});
});
