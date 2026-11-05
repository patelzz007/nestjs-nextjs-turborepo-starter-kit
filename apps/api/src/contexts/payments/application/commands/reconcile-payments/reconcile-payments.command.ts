import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { ReconciliationRun } from "../../services/payments.service";

/** Ask the gateways about payments still open after a while, and apply what they say. */
export class ReconcilePaymentsCommand extends Command<ReconciliationRun> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
