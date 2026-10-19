import { Command } from "@nestjs/cqrs";
import type { PolicySimulationResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { PolicyControlPlaneActor } from "../../../domain/aggregates/authorization-policy-draft.aggregate";

/** Evaluate a draft against the published policy over the real principals in its scope, and record the result. */
export class SimulatePolicyDraftCommand extends Command<PolicySimulationResult> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly policyActor: PolicyControlPlaneActor,
		public readonly draftId: string,
	) {
		super();
	}
}
