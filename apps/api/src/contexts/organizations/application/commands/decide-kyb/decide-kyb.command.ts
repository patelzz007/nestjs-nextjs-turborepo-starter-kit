import { Command } from "@nestjs/cqrs";
import type { AdminKybUpdateInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface DecideKybInput extends AdminKybUpdateInput {
	readonly organizationId: string;
}

/** A platform admin decides a merchant's business verification. */
export class DecideKybCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: DecideKybInput,
	) {
		super();
	}
}
