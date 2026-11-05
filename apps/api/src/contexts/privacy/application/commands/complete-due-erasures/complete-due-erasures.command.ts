import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { ErasureRun } from "../../services/account-erasure.service";

/** Carry out account erasures whose 30-day grace period has ended (ADR 077). */
export class CompleteDueErasuresCommand extends Command<ErasureRun> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
