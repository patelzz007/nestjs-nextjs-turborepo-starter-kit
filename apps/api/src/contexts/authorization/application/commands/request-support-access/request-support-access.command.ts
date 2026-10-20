import { Command } from "@nestjs/cqrs";
import type { SupportAccessGrantRequestInput, SupportAccessGrantResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** A SuperAdmin requests just-in-time access to one tenant (pending its owner's approval). */
export class RequestSupportAccessCommand extends Command<SupportAccessGrantResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SupportAccessGrantRequestInput,
	) {
		super();
	}
}
