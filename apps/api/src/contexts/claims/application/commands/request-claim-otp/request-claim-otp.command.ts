import { Command } from "@nestjs/cqrs";
import type { RequestClaimOtpInput, RequestClaimOtpResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /claims/otp`. */
export class RequestClaimOtpCommand extends Command<RequestClaimOtpResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RequestClaimOtpInput,
	) {
		super();
	}
}
