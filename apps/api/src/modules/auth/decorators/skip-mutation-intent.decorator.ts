import { SetMetadata } from "@nestjs/common";

/** Metadata key for routes exempt from mutation-intent enforcement. */
export const SKIP_MUTATION_INTENT_KEY = "skipMutationIntent";

/**
 * Exempt a route from Origin/Referer + mutation-intent checks.
 * Use only for documented non-browser integrations (webhooks, etc.).
 */
export const SkipMutationIntent = (): ReturnType<typeof SetMetadata> => SetMetadata(SKIP_MUTATION_INTENT_KEY, true);
