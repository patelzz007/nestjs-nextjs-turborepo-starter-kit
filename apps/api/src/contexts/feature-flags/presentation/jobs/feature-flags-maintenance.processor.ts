import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable } from "@nestjs/common";
import { MONITORED_WORKER_OPTIONS } from "@workspace/messaging/nest";
import { FeatureFlagsMaintenanceJobSchema, QUEUE_NAMES } from "@workspace/shared";
import type { Job } from "bullmq";

import type { FlagMaintenanceService, MaintenanceOutcome } from "../../application/services/flag-maintenance.service";
import { FLAG_MAINTENANCE } from "../../feature-flags.tokens";

/** `feature-flags.maintenance` → expire pending revisions, announce scheduled steps; a failure rethrows so BullMQ retries. */
@Processor(QUEUE_NAMES.featureFlagsMaintenance, MONITORED_WORKER_OPTIONS)
@Injectable()
export class FeatureFlagsMaintenanceProcessor extends WorkerHost {
	public constructor(@Inject(FLAG_MAINTENANCE) private readonly maintenance: FlagMaintenanceService) {
		super();
	}

	public process(job: Pick<Job, "data">): Promise<MaintenanceOutcome> {
		FeatureFlagsMaintenanceJobSchema.parse(job.data);
		return this.maintenance.run();
	}
}
