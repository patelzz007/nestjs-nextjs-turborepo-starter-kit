import { Command } from "@nestjs/cqrs";
import type { PolicyPublishResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { PolicyControlPlaneActor } from "../../../domain/aggregates/authorization-policy-draft.aggregate";

export interface PublishPolicyInput {
	readonly draftId: string;
	readonly approvalNote: string | undefined;
}

/** Approve and publish a draft by a SECOND SuperAdmin (four-eyes). */
export class PublishPolicyCommand extends Command<PolicyPublishResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly policyActor: PolicyControlPlaneActor,
		public readonly input: PublishPolicyInput,
	) {
		super();
	}
}
