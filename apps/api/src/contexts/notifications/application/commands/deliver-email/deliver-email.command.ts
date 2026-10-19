import { Command } from "@nestjs/cqrs";
import type { EmailSendJob } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One execution of a queued (or inline) delivery: the `emailSend` job plus its attempt bookkeeping. */
export interface DeliverEmailInput extends EmailSendJob {
	/** 1-based number of this execution. */
	readonly attemptNumber: number;
	readonly maxAttempts: number;
}

export type DeliverEmailResult = { readonly outcome: "sent"; readonly providerMessageId: string } | { readonly outcome: "skipped" };

/** Deliver one requested email: ONE provider call; the caller (BullMQ, or the inline loop) owns retries. */
export class DeliverEmailCommand extends Command<DeliverEmailResult> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: DeliverEmailInput,
	) {
		super();
	}
}
