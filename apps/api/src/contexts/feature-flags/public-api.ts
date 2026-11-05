// The feature-flags context's public surface (enhancements 5.6, 5.11): its module, and the store-flag reader a
// context that acts at a store (the till's redemption) asks whether a flag is on there.
export { FeatureFlagsModule } from "./feature-flags.module";
export { STORE_FEATURE_FLAGS, type StoreFeatureFlags } from "./application/ports/store-feature-flags.port";
