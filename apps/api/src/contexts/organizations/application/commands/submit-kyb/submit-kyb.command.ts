import { Command } from "@nestjs/cqrs";
import type { MerchantKybProfileResponse, MerchantKybSubmissionFieldsInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface SubmitKybInput extends MerchantKybSubmissionFieldsInput {
	readonly orgSlug: string;
}

/** The owner (re)submits business verification details and evidence. */
export class SubmitKybCommand extends Command<MerchantKybProfileResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SubmitKybInput,
	) {
		super();
	}
}
