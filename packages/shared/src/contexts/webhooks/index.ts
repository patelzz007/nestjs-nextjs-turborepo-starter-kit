// The `webhooks` context's shared contract: inbound (received webhooks, ADR 081) and outbound (ADR 082).
// Import it as `@workspace/shared/contexts/webhooks` to depend on this context alone; the root
// `@workspace/shared` barrel re-exports its curated subset (root-exports.ts).

export * from "./received-webhooks.contract";
export * from "./received-webhooks.routes";
export * from "./schemas/received-webhooks";
export * from "./outbound-webhooks.contract";
export * from "./outbound-webhooks.routes";
export * from "./schemas/outbound-webhook-events";
export * from "./schemas/outbound-webhooks";
