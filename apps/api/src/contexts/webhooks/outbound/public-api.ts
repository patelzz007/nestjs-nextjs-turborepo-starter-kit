/*
 * The outbound half of the webhooks context's public surface (ADR 082). No other context imports it: producers'
 * events reach it through in-transaction handlers it registers itself.
 *
 * - `WebhooksOutboundModule` is a composition module: `app.module.ts` imports it from here.
 */
export { WebhooksOutboundModule } from "./webhooks-outbound.module";
