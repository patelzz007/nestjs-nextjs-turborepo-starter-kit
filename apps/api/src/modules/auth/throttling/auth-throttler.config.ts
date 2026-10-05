import type { ThrottlerModuleOptions } from "@nestjs/throttler";

import { throttleTrackerFor } from "../../../common/http/client-ip";
import type { TypedConfigService } from "../../../config/typed-config.service";

/**
 * Named throttlers used by `@Throttle({ strict: … })` and `@Throttle({ default: … })`
 * on auth controllers. `strict` guards credential endpoints; `default` covers
 * authenticated mutations.
 */
export function authThrottlerOptionsFactory(config: TypedConfigService): ThrottlerModuleOptions {
	return {
		errorMessage: "Too many requests — please try again shortly.",
		getTracker: (req: Record<string, string>): string => throttleTrackerFor(req),
		throttlers: [
			{ name: "strict", ttl: config.rateLimits.throttleTtlMs, limit: config.rateLimits.throttleStrictLimit },
			{ name: "default", ttl: config.rateLimits.throttleTtlMs, limit: config.rateLimits.throttleDefaultLimit },
		],
	};
}
