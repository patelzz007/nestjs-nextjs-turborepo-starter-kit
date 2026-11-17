/*
 * The ONLY file other code may import from tiers (plan §6.4; ADR 085).
 *
 * - `TiersAccessModule` (a global leaf): `CUSTOMER_TIER_ACCESS` (customers' tiers for rewards, claims and a merchant's
 *   customer list) and pos's `CUSTOMER_TIER_SNAPSHOT_FACTORY` (the tier recorded on a redemption). Their ports live in
 *   `platform/application/ports`, so no context imports tiers.
 * - `TiersModule` is a composition module: `app.module.ts` imports it from `./tiers.module` directly.
 */
export { TiersAccessModule } from "./infrastructure/tiers-access.module";
