// The feature-flags context's public surface (enhancements 5.6, 5.11): its module, the store-flag reader a context that
// acts at a store (the till's redemption) asks whether a flag is on there, and the reader of the deployment-wide flags
// the API decides on (customer tiers, ADR 085).
export { FeatureFlagsModule } from "./feature-flags.module";
export { STORE_FEATURE_FLAGS, type StoreFeatureFlags } from "./application/ports/store-feature-flags.port";
export { API_FEATURE_FLAGS, type ApiFeatureFlags } from "./application/ports/api-feature-flags.port";
export { FEATURE_FLAGS_EVALUATE_OPERATION } from "./application/ports/feature-flags.operations";
