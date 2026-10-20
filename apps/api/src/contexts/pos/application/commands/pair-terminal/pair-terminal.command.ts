import { Command } from "@nestjs/cqrs";
import type { PosPairedTerminal, PosPairTerminalInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /integration/terminals/pair`: a till exchanges its one-time code for its own API key. */
export class PairTerminalCommand extends Command<PosPairedTerminal> {
	public constructor(
		/** The (anonymous) caller: the till has no credential yet. */
		public readonly actor: ActorContext,
		public readonly input: PosPairTerminalInput,
	) {
		super();
	}
}
