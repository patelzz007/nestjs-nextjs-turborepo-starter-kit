import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression, SchedulerRegistry } from "@nestjs/schedule";
import { CaughtValueSchema } from "@workspace/shared";

import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";
import { WEBHOOK_DELIVERY_ENGINE } from "../../application/ports/webhook-delivery-engine.token";
import type { SweepResult, WebhookDeliveryEngine } from "../../application/services/webhook-delivery-engine";

export const WEBHOOK_SWEEP_SCHEDULER_ID = "webhooks.outbound.sweep-timer";
/** How often an instance looks for due retries and events that missed their immediate fan-out. */
export const WEBHOOK_SWEEP_INTERVAL_MS = 5_000;

/**
 * Runs the outgoing-webhook sweep on every instance (a claim's lease keeps two instances from sending one delivery
 * twice). A sweep still running when the next tick fires is not overlapped; a failed one is logged and the next
 * tick retries. Once a day each instance also purges events past their retention (a bounded, idempotent delete).
 */
@Injectable()
export class WebhookSweepScheduler implements OnModuleInit, OnApplicationShutdown {
	private readonly logger: Logger = new Logger(WebhookSweepScheduler.name);
	private running = false;

	public constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		@Inject(WEBHOOK_DELIVERY_ENGINE) private readonly engine: Pick<WebhookDeliveryEngine, "sweepOnce" | "purgeExpired">,
	) {}

	public onModuleInit(): void {
		const timer: NodeJS.Timeout = setInterval((): void => {
			void this.runOnce();
		}, WEBHOOK_SWEEP_INTERVAL_MS);
		timer.unref();
		this.schedulerRegistry.addInterval(WEBHOOK_SWEEP_SCHEDULER_ID, timer);
	}

	public onApplicationShutdown(): void {
		if (this.schedulerRegistry.doesExist("interval", WEBHOOK_SWEEP_SCHEDULER_ID)) {
			this.schedulerRegistry.deleteInterval(WEBHOOK_SWEEP_SCHEDULER_ID);
		}
	}

	/** One sweep, unless one is already running. Never rejects. */
	public async runOnce(): Promise<SweepResult | null> {
		if (this.running) {
			return null;
		}
		this.running = true;
		try {
			const result = await this.engine.sweepOnce();
			if (result.fannedOut > 0 || result.attempted > 0) {
				this.logger.debug({ event: "webhooks.outbound.swept", ...result });
			}
			return result;
		} catch (error) {
			this.logger.error({ event: "webhooks.outbound.sweep_failed", ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
			return null;
		} finally {
			this.running = false;
		}
	}

	@Cron(CronExpression.EVERY_DAY_AT_3AM)
	public async purge(): Promise<number> {
		try {
			const purged = await this.engine.purgeExpired();
			if (purged > 0) {
				this.logger.log({ event: "webhooks.outbound.purged", purged });
			}
			return purged;
		} catch (error) {
			this.logger.error({ event: "webhooks.outbound.retention_failed", ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
			return 0;
		}
	}
}
