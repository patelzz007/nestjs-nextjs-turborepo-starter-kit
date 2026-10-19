import { Command } from "@nestjs/cqrs";
import type { OkResponse, RequestClaimOtpInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /claims/otp`. */
export class RequestClaimOtpCommand extends Command<OkResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RequestClaimOtpInput,
	) {
		super();
	}
}
