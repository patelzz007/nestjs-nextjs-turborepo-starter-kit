/** Some customers' nightly review failed (each was logged); the run is audited as failed and they are reviewed next night. */
export class TierReviewItemsFailedError extends Error {
	public constructor(
		public readonly failed: number,
		public readonly firstFailure: Error,
	) {
		super(`${String(failed)} customer tier review(s) failed; first: ${firstFailure.message}`, { cause: firstFailure });
		this.name = "TierReviewItemsFailedError";
	}
}
