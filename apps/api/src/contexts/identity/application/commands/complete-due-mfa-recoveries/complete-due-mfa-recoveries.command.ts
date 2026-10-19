import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface CompleteDueMfaRecoveriesInput {
	readonly reason: string;
}

/** Cron: clear the second factor of every approved recovery whose delay elapsed. Returns how many completed. */
export class CompleteDueMfaRecoveriesCommand extends Command<number> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CompleteDueMfaRecoveriesInput,
	) {
		super();
	}
}
