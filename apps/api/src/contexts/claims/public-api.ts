/*
 * The ONLY file other contexts may import from claims (plan §6.4).
 *
 * - `createClaimsTransactionalPorts(db, codeHasher, events)` (infrastructure only): `ClaimRedemptionPort`,
 *   the merchant-side claim lookup and redemption, bound to YOUR transaction and event collector (pos's checkout).
 * - `ClaimsModule` is a composition module: `app.module.ts` imports it from `./claims.module` directly.
 */
export type { ClaimRedemptionLookup, ClaimRedemptionPort } from "./application/ports/claim-redemption.port";
export { createClaimsTransactionalPorts, type ClaimsTransactionalPorts } from "./infrastructure/persistence/claims-transactional-ports";
export { ClaimNoLongerRedeemableError } from "./domain/errors/claims.errors";
