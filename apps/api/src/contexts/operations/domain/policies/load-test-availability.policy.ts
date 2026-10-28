// ============================================
// domain/policies/load-test-availability.policy.ts — whether load tests may run on this deployment
// ============================================
// Pure function (no I/O). Off unless enabled; production needs a second, explicit switch; and the
// runner's queue needs Redis (ADR 068).

/** Load tests can run, or why not (shown on the Load tests screen). */
export type LoadTestAvailability = { readonly enabled: true } | { readonly enabled: false; readonly reason: string };

export function loadTestAvailability(input: {
	readonly enabled: boolean;
	readonly allowProduction: boolean;
	readonly isProduction: boolean;
	readonly queueAvailable: boolean;
}): LoadTestAvailability {
	if (!input.enabled) {
		return { enabled: false, reason: "Load testing is off on this deployment. Set LOAD_TESTING_ENABLED=true to turn it on." };
	}
	if (input.isProduction && !input.allowProduction) {
		return { enabled: false, reason: "This is production: load tests also need LOAD_TESTING_ALLOW_PRODUCTION=true." };
	}
	if (!input.queueAvailable) {
		return { enabled: false, reason: "Load tests run on the load runner through Redis, and REDIS_URL is not set." };
	}
	return { enabled: true };
}
