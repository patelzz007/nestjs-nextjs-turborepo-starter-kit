import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { PRE_AUTH_THROTTLER } from "./rate-limit-policy";

/**
 * The coarse pre-authentication throttler only (`preAuth`, per client IP).
 * Registered BEFORE `AuthGuard` in `APP_GUARD_ORDER`, so requests with bad or
 * missing credentials are counted before authentication rejects them.
 */
@Injectable()
export class PreAuthThrottlerGuard extends ThrottlerGuard {
	public override async onModuleInit(): Promise<void> {
		await super.onModuleInit();
		this.throttlers = this.throttlers.filter((throttler): boolean => throttler.name === PRE_AUTH_THROTTLER);
	}
}

/**
 * Every named throttler except `preAuth` (`strict`, `default`, `webhook`).
 * Registered AFTER `AuthGuard`, so the principal tracker sees `request.user`.
 */
@Injectable()
export class PrincipalThrottlerGuard extends ThrottlerGuard {
	public override async onModuleInit(): Promise<void> {
		await super.onModuleInit();
		this.throttlers = this.throttlers.filter((throttler): boolean => throttler.name !== PRE_AUTH_THROTTLER);
	}
}
