import { ApiKeyAuthGuard } from "./guards/api-key-auth.guard";
import { AuthGuard } from "./guards/auth.guard";
import { AuthorizationGuard } from "./guards/authorization.guard";
import { MobileAppVersionGuard } from "./guards/mobile-app-version.guard";
import { MutationIntentGuard } from "./guards/mutation-intent.guard";
import { RestrictedSessionGuard } from "./guards/restricted-session.guard";
import { PreAuthThrottlerGuard, PrincipalThrottlerGuard } from "./throttling/scoped-throttler.guards";

/**
 * Global guard order. An outdated mobile app is rejected before any other answer.
 * Then the coarse per-IP pre-authentication throttler, so a flood of bad
 * credentials is counted before authentication can reject it. Then the
 * same-origin mutation-intent check for cookie-authenticated writes (it reads
 * only headers, so it needs no principal). Then an optional
 * API key, then the JWT. The principal throttlers run after `AuthGuard` so
 * `request.user` and `apiKeyAuth` exist and the tracker can key on the principal.
 * Public credential routes still count, because `AuthGuard` lets them through.
 * Then a restricted session, then authorization.
 */
export const APP_GUARD_ORDER: [
	typeof MobileAppVersionGuard,
	typeof PreAuthThrottlerGuard,
	typeof MutationIntentGuard,
	typeof ApiKeyAuthGuard,
	typeof AuthGuard,
	typeof PrincipalThrottlerGuard,
	typeof RestrictedSessionGuard,
	typeof AuthorizationGuard,
] = [MobileAppVersionGuard, PreAuthThrottlerGuard, MutationIntentGuard, ApiKeyAuthGuard, AuthGuard, PrincipalThrottlerGuard, RestrictedSessionGuard, AuthorizationGuard];
