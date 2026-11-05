import { MetricsTime, type WorkerOptions } from "bullmq";

/**
 * Worker options every BullMQ processor in the application passes: `@Processor(QUEUE, MONITORED_WORKER_OPTIONS)`.
 *
 * `metrics` makes each worker record how many jobs completed and failed per minute (BullMQ's own metrics,
 * kept in Redis for the last hour). The operations console's Queues screen reads them for each queue's
 * failure rate (enhancement 4.4). `@nestjs/bullmq` passes only the connection and prefix from the root
 * config to workers, so this is set per processor; the queue e2e test checks every worker has it.
 */
export const MONITORED_WORKER_OPTIONS: Pick<WorkerOptions, "metrics"> = { metrics: { maxDataPoints: MetricsTime.ONE_HOUR } };
