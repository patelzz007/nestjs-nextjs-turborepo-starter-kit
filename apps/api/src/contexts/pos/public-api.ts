/*
 * The ONLY file other contexts may import from pos (plan §6.4).
 *
 * - `PosAccessModule` (a global leaf): `API_KEY_VERIFICATION` and `TILL_RESOLVER` for the security kit's guards, and the
 *   ports tenants consumes, `API_KEY_CAPABILITIES` and `LOCATION_CLOSURE_FACTORY`.
 * - `PosModule` is a composition module: `app.module.ts` imports it from `./pos.module` directly.
 * - The pos domain error codes, for the HTTP status map.
 * - The key format and backup-code lockout limits the seed data and the e2e suite build fixtures with.
 */
export { PosAccessModule } from "./infrastructure/pos-access.module";
export { API_KEY_PREFIX_LENGTH } from "./domain/value-objects/api-key-format.value-object";
export { POS_CODE_LOCKOUT_MS, POS_CODE_MAX_FAILURES } from "./domain/policies/code-lockout.policy";
// The event other contexts may react to (outgoing webhooks, ADR 082; customer tiers, ADR 085).
export { SaleCheckedOut } from "./domain/events/pos.events";
// The customer's tier at a redemption: pos consumes it by token, the tiers context provides it (ADR 085).
export { CUSTOMER_TIER_SNAPSHOT_FACTORY } from "./application/ports/pos.tokens";
export type { CustomerTierSnapshotFactory } from "./infrastructure/persistence/pos-scope.factory";
