import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";

import type { ModuleHealthIndicator, ModuleHealthReport } from "../../presentation/http/health/health.service";
import { registerMaintenanceScheduler, type MaintenanceSchedulerDefinition, type MaintenanceSchedulerQueue } from "./maintenance-scheduler";

/** How long the first registration of every scheduler may take before readiness stops waiting for it. */
export const MAINTENANCE_SCHEDULER_TIMEOUT_MS = 10_000;
/** The pause before a failed or timed-out registration is tried again. */
export const MAINTENANCE_SCHEDULER_RETRY_MS = 30_000;

/** Where the registrations stand: still on the first attempt, all registered, or retrying after a failure. */
export type MaintenanceSchedulerState = "pending" | "registered" | "retrying";

/** One periodic maintenance job a module asked for. */
interface SchedulerRegistration {
	readonly queue: MaintenanceSchedulerQueue;
	readonly definition: MaintenanceSchedulerDefinition<object>;
}

/**
 * Every periodic maintenance job of the API, registered together once the application has booted.
 *
 * Modules `add` their schedulers while they initialise (nothing touches Redis then, so boot never waits
 * on it); after bootstrap every registration runs at once (`Promise.allSettled`), bounded by
 * {@link MAINTENANCE_SCHEDULER_TIMEOUT_MS}. As a CRITICAL health indicator it keeps `GET /health/ready` at
 * 503 until that first attempt settles. A failure or timeout does not hold the instance out of rotation:
 * it is reported (`retrying`, with the failed scheduler ids) and retried every
 * {@link MAINTENANCE_SCHEDULER_RETRY_MS} — a Redis blip at boot must not become an API outage, and
 * `upsertJobScheduler` is idempotent, so retrying an already-registered scheduler is harmless.
 */
@Injectable()
export class MaintenanceSchedulerRegistry implements OnApplicationBootstrap, OnApplicationShutdown, ModuleHealthIndicator {
	private readonly logger: Logger = new Logger(MaintenanceSchedulerRegistry.name);
	private readonly registrations: SchedulerRegistration[] = [];
	private state: MaintenanceSchedulerState = "pending";
	private failedSchedulerIds: readonly string[] = [];
	private retryTimer: NodeJS.Timeout | undefined;
	private stopped = false;

	/** Queue a scheduler for registration. Call it from `onModuleInit`; it never waits on Redis. */
	public add<TData extends object>(queue: MaintenanceSchedulerQueue, definition: MaintenanceSchedulerDefinition<TData>): void {
		this.registrations.push({ queue, definition });
	}

	public onApplicationBootstrap(): void {
		void this.registerAll();
	}

	public onApplicationShutdown(): void {
		this.stopped = true;
		clearTimeout(this.retryTimer);
	}

	public get currentState(): MaintenanceSchedulerState {
		return this.state;
	}

	/** Registers every queued scheduler at once; resolves when the attempt settled (or timed out). */
	public async registerAll(): Promise<void> {
		const outcomes = await this.withTimeout(
			Promise.allSettled(this.registrations.map(({ queue, definition }) => registerMaintenanceScheduler(queue, definition, this.logger))),
		);
		const failed: string[] =
			outcomes === null
				? this.registrations.map(({ definition }) => definition.schedulerId)
				: this.registrations.flatMap(({ definition }, index) => (outcomes.at(index)?.status === "fulfilled" ? [] : [definition.schedulerId]));
		this.failedSchedulerIds = failed;
		if (failed.length === 0) {
			this.state = "registered";
			this.logger.log(`Registered ${String(this.registrations.length)} BullMQ maintenance scheduler(s)`);
			return;
		}
		this.state = "retrying";
		this.logger.warn(
			`Could not register maintenance scheduler(s) ${failed.join(", ")}${outcomes === null ? ` within ${String(MAINTENANCE_SCHEDULER_TIMEOUT_MS)} ms` : ""}; retrying in ${String(MAINTENANCE_SCHEDULER_RETRY_MS)} ms`,
		);
		this.scheduleRetry();
	}

	/** Ready once the first attempt settled; a later failure is reported, not fatal. */
	public isHealthy(): Promise<boolean> {
		return Promise.resolve(this.state !== "pending");
	}

	public getReport(): Promise<ModuleHealthReport> {
		return Promise.resolve({ state: this.state, schedulers: this.registrations.length, failed: this.failedSchedulerIds.join(",") });
	}

	private scheduleRetry(): void {
		if (this.stopped) {
			return;
		}
		this.retryTimer = setTimeout((): void => {
			void this.registerAll();
		}, MAINTENANCE_SCHEDULER_RETRY_MS);
		this.retryTimer.unref();
	}

	/** The settled outcomes, or `null` when they took longer than the timeout. */
	private async withTimeout<T>(work: Promise<T>): Promise<T | null> {
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<null>((resolve): void => {
			timer = setTimeout((): void => {
				resolve(null);
			}, MAINTENANCE_SCHEDULER_TIMEOUT_MS);
		});
		try {
			return await Promise.race([work, timeout]);
		} finally {
			clearTimeout(timer);
		}
	}
}
