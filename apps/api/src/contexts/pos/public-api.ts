/*
 * The ONLY file other contexts may import from pos (plan §6.4).
 *
 * - `PosAccessModule` (a global leaf): `API_KEY_VERIFICATION` and `TILL_RESOLVER` for the security kit's guards, and the
 *   ports tenants consumes, `API_KEY_CAPABILITIES` and `STORE_CLOSURE_FACTORY`.
 * - `PosModule` is a composition module: `app.module.ts` imports it from `./pos.module` directly.
 * - The pos domain error codes, for the HTTP status map.
 * - The key format and backup-code lockout limits the seed data and the e2e suite build fixtures with.
 */
export { PosDomainErrorCodeSchema, type PosDomainErrorCode } from "./domain/errors/pos.errors";
export { PosAccessModule } from "./infrastructure/pos-access.module";
export { API_KEY_PREFIX_LENGTH } from "./domain/value-objects/api-key-format.value-object";
export { POS_CODE_LOCKOUT_MS, POS_CODE_MAX_FAILURES } from "./domain/policies/code-lockout.policy";
