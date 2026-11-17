import { Logger } from "@nestjs/common";
import { FeatureFlagExposureEventSchema } from "@workspace/shared";

import type { PlatformOutboxService } from "../../../../platform/infrastructure/outbox/platform-outbox.service";
import type { ExposureBatchRecord, ExposureRecorder } from "../../application/ports/exposure-recorder.port";

/**
 * Exposures as `feature_flag.exposure` telemetry (ADR 087): one outbox row per batch, relayed to Kafka and projected
 * by the analytics consumer. Telemetry describes no write of its own, so it is recorded in its own transaction and
 * a failure is logged, never thrown at the caller (an exposure is never worth failing a request over).
 */
export class OutboxExposureRecorder implements ExposureRecorder {
	private readonly logger: Logger = new Logger(OutboxExposureRecorder.name);

	public constructor(private readonly outbox: PlatformOutboxService) {}

	public async record(batch: ExposureBatchRecord): Promise<void> {
		const result = await this.outbox.recordTelemetry({
			type: "feature_flag.exposure",
			payload: FeatureFlagExposureEventSchema.parse({ app: batch.app, exposures: batch.exposures }),
		});
		if (!result.recorded) {
			this.logger.warn({ event: "feature_flags.exposures_not_recorded", count: batch.exposures.length, error: result.error });
		}
	}
}
