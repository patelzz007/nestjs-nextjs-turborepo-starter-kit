import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface PurgeStaleWebAuthnChallengesInput {
	readonly reason: string;
}

/** Cron: soft-delete WebAuthn challenges past their retention. Returns how many. */
export class PurgeStaleWebAuthnChallengesCommand extends Command<number> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: PurgeStaleWebAuthnChallengesInput,
	) {
		super();
	}
}
