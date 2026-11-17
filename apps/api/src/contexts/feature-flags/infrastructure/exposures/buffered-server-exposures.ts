import { exposureDedupeKey, EXPOSURE_BATCH_MAX } from "@workspace/shared";
import type { OnModuleDestroy } from "@nestjs/common";

import type { ExposureRecorder } from "../../application/ports/exposure-recorder.port";
import type { ServerExposure, ServerExposures } from "../../application/ports/server-exposures.port";

/** The same decision for the same subject is noted at most once per hour. */
export const SERVER_EXPOSURE_DEDUPE_MS = 3_600_000;
/** Noted exposures are sent at least this often. */
export const SERVER_EXPOSURE_FLUSH_MS = 10_000;
/** Most decisions remembered for de-duplication; past it, the oldest are forgotten (and may be noted again). */
const DEDUPE_MAX_ENTRIES = 50_000;

/**
 * Exposures of the API's own checks (a till's redemption, customer tiers, `@RequireFeatureFlag`): each new decision
 * per subject is noted once an hour and the notes go out in batches every 10 seconds or every 50, whichever comes
 * first, so a busy check never writes an outbox row per call. Whatever is pending is sent on shutdown.
 */
export class BufferedServerExposures implements ServerExposures, OnModuleDestroy {
	private readonly seen = new Map<string, number>();
	private pending: ServerExposure[] = [];
	private readonly timer: NodeJS.Timeout;

	public constructor(
		private readonly recorder: ExposureRecorder,
		private readonly now: () => number,
	) {
		this.timer = setInterval((): void => {
			void this.flush();
		}, SERVER_EXPOSURE_FLUSH_MS);
		this.timer.unref();
	}

	public note(exposure: ServerExposure): void {
		const key = `${exposure.subjectUnit}|${exposure.subjectId}|${exposureDedupeKey(exposure)}`;
		const at = this.now();
		const last = this.seen.get(key);
		if (last !== undefined && at - last < SERVER_EXPOSURE_DEDUPE_MS) {
			return;
		}
		this.remember(key, at);
		this.pending.push(exposure);
		if (this.pending.length >= EXPOSURE_BATCH_MAX) {
			void this.flush();
		}
	}

	public async flush(): Promise<void> {
		while (this.pending.length > 0) {
			const batch = this.pending.slice(0, EXPOSURE_BATCH_MAX);
			this.pending = this.pending.slice(EXPOSURE_BATCH_MAX);
			await this.recorder.record({ app: "api", exposures: batch });
		}
	}

	public async onModuleDestroy(): Promise<void> {
		clearInterval(this.timer);
		await this.flush();
	}

	private remember(key: string, at: number): void {
		this.seen.delete(key);
		this.seen.set(key, at);
		if (this.seen.size > DEDUPE_MAX_ENTRIES) {
			const oldest = this.seen.keys().next();
			if (oldest.done !== true) {
				this.seen.delete(oldest.value);
			}
		}
	}
}
