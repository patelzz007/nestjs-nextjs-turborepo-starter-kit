import type { Exposure, RolloutUnit } from "@workspace/shared";

/** An exposure from a server-side check, with its subject. */
export type ServerExposure = Exposure & { readonly subjectUnit: RolloutUnit; readonly subjectId: string };

/**
 * Exposures of the API's own checks: a till checks a flag on every sale, so the same decision is noted once per
 * hour per subject and sent in batches, never one outbox row per check.
 */
export interface ServerExposures {
	note(exposure: ServerExposure): void;
}

export const SERVER_EXPOSURES = Symbol("SERVER_EXPOSURES");
