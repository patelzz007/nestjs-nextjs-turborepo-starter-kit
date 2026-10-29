import { CaughtValueSchema } from "@workspace/shared";
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";

import { AUTHORIZATION_CHANGE_SWEEP_INTERVAL_MS, AuthorizationChangeSweep, type AuthorizationChangeSweepResult } from "../../application/services/authorization-change-sweep";
import { caughtErrorLogFields } from "../../../../platform/application/errors/caught-error-log";

export const AUTHORIZATION_CHANGE_SWEEP_SCHEDULER_ID = "identity.authorization-change-sweep";

/**
 * Runs {@link AuthorizationChangeSweep} on EVERY instance (not a queue job: each instance cleans its own
 * caches). A sweep still running when the next tick fires is not overlapped — that tick is skipped. A failed
 * sweep is logged at `error` and the next tick retries; the timer itself never dies.
 */
@Injectable()
export class AuthorizationChangeSweepScheduler implements OnModuleInit, OnApplicationShutdown {
	private readonly logger: Logger = new Logger(AuthorizationChangeSweepScheduler.name);
	private running = false;

	public constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly sweep: AuthorizationChangeSweep,
	) {}

	public onModuleInit(): void {
		const timer: NodeJS.Timeout = setInterval((): void => {
			void this.runOnce();
		}, AUTHORIZATION_CHANGE_SWEEP_INTERVAL_MS);
		timer.unref();
		this.schedulerRegistry.addInterval(AUTHORIZATION_CHANGE_SWEEP_SCHEDULER_ID, timer);
	}

	public onApplicationShutdown(): void {
		if (this.schedulerRegistry.doesExist("interval", AUTHORIZATION_CHANGE_SWEEP_SCHEDULER_ID)) {
			this.schedulerRegistry.deleteInterval(AUTHORIZATION_CHANGE_SWEEP_SCHEDULER_ID);
		}
	}

	/** One sweep, unless one is already running. Never rejects: a failure is logged and retried on the next tick. */
	public async runOnce(): Promise<AuthorizationChangeSweepResult | null> {
		if (this.running) {
			return null;
		}
		this.running = true;
		try {
			const result: AuthorizationChangeSweepResult = await this.sweep.sweepOnce();
			if (result.invalidated > 0) {
				this.logger.debug({ event: "identity.authorization_change_sweep", ...result });
			}
			return result;
		} catch (error) {
			this.logger.error({ event: "identity.authorization_change_sweep_failed", ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
			return null;
		} finally {
			this.running = false;
		}
	}
}
