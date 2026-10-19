import { Command } from "@nestjs/cqrs";
import type { CreatePolicyDraftInput, PolicyDraftCreatedResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { PolicyControlPlaneActor } from "../../../domain/aggregates/authorization-policy-draft.aggregate";

/** Compile, validate and store a policy draft. SuperAdmin-only (route), refused for impersonated sessions. */
export class CreatePolicyDraftCommand extends Command<PolicyDraftCreatedResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly policyActor: PolicyControlPlaneActor,
		public readonly input: CreatePolicyDraftInput,
	) {
		super();
	}
}
