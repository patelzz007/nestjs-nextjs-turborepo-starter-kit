// The feature-flags context's public surface (ADR 087): its module; the server-side check other contexts ask
// (`FEATURE_FLAGS`) and the route decorator built on it; the registry other contexts supply a person's facts to;
// and the evaluate operation a public route that asks about a flag runs under.
export { FeatureFlagsModule } from "./feature-flags.module";
export { FeatureFlagsQueueModule } from "./infrastructure/queue/feature-flags-queue.module";
export { FEATURE_FLAGS, DEPLOYMENT_WIDE, type FeatureFlags, type FlagCheckSubject } from "./application/ports/feature-flags.port";
export { FEATURE_FLAGS_EVALUATE_OPERATION } from "./application/ports/feature-flags.operations";
export { SUBJECT_FACTS } from "./feature-flags.tokens";
export type { SubjectFactsRegistry } from "./application/services/subject-facts.registry";
export type { SubjectFactSource } from "./application/ports/subject-facts.port";
export { RequireFeatureFlag, FeatureFlagGuard } from "./presentation/http/require-feature-flag";
export { FeatureUnavailableError } from "./domain/errors/feature-flag.errors";
