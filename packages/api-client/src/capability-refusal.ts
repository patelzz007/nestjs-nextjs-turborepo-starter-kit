import { ApiError } from "./errors";

/**
 * The API's answers that mean "your role or grants no longer allow this" (ADR 067): the platform permission check
 * (`PERMISSION_DENIED`) and the merchant capability gate (`TENANT_ROLE_CAPABILITY_REQUIRED`). When one arrives, the
 * session's capabilities are out of date (a role was changed, a grant revoked) and every app reads them again, so the
 * actions the member may no longer use disappear. Other 403s (a store outside the member's scope, a suspended
 * tenant) are not about the member's capabilities.
 */
export const CAPABILITY_REFUSAL_CODES: ReadonlySet<string> = new Set(["PERMISSION_DENIED", "TENANT_ROLE_CAPABILITY_REQUIRED"]);

/** HTTP 403 Forbidden. */
const FORBIDDEN_STATUS = 403;

/** Whether `error` is the API refusing an action because of the member's capabilities. */
export function isCapabilityRefusal(error: Error): boolean {
	return error instanceof ApiError && error.statusCode === FORBIDDEN_STATUS && error.code !== undefined && CAPABILITY_REFUSAL_CODES.has(error.code);
}
