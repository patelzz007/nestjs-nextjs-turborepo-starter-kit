import type { BundleApp, Exposure, RolloutUnit } from "@workspace/shared";

/** A batch of exposures with the subject the API worked out (never the client's word for it). */
export interface ExposureBatchRecord {
	readonly app: BundleApp | "api";
	readonly exposures: readonly (Exposure & { readonly subjectUnit: RolloutUnit; readonly subjectId: string })[];
}

/** Hands a batch to the analytics pipeline (outbox → Kafka → analytics consumer). Never throws. */
export interface ExposureRecorder {
	record(batch: ExposureBatchRecord): Promise<void>;
}

export const EXPOSURE_RECORDER = Symbol("EXPOSURE_RECORDER");
