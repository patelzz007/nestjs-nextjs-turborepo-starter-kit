import { Inject, Injectable } from "@nestjs/common";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { RATE_LIMITER, type RateLimiter } from "../../../../platform/application/ports/rate-limiter.port";
import { destinationSubject } from "../../../../platform/infrastructure/rate-limiting/destination-subject";

/** Length of the per-recipient counting window. */
export const EMAIL_RATE_WINDOW_MS = 60_000;

/** Name of the per-recipient email policy (key segment and refusal-log name). */
export const EMAIL_RECIPIENT_POLICY = "EMAIL_RECIPIENT";

/**
 * Per-recipient send limit (`EMAIL_RATE_LIMIT_PER_MINUTE`, 0 = off): a rolling one-minute window per
 * recipient, counted by the shared `RateLimiter` (ADR 071) so the limit holds across API instances.
 * The subject is a SHA-256 of the normalized address. It fails closed: while Redis is down a bounded
 * local store counts, refusing NEW recipients once full.
 */
@Injectable()
export class EmailRecipientRateLimiter {
	public constructor(
		private readonly config: TypedConfigService,
		@Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
	) {}

	/** Count one send to `recipient`; false when it would exceed the limit. */
	public async tryAcquire(recipient: string): Promise<boolean> {
		const limit: number = this.config.email.rateLimitPerMinute;
		if (limit <= 0) {
			return true;
		}
		const decision = await this.limiter.consume({
			policyName: EMAIL_RECIPIENT_POLICY,
			rule: { algorithm: "sliding-window", limit, windowMs: EMAIL_RATE_WINDOW_MS, penalty: null },
			subject: destinationSubject(recipient),
			cost: 1,
			failMode: "closed",
		});
		return decision.allowed;
	}
}
