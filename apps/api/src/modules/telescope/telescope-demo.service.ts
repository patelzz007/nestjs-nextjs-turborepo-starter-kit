import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import type { TelescopeOptions } from "@workspace/shared";

import { TelescopeJobRunner } from "./telescope-job-runner.js";
import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options.js";
import { TelescopeSchedulerService } from "./telescope-scheduler.js";
import type { TelescopeStore } from "./telescope.store.js";

/**
 * Demo wiring for the Jobs + Schedules pages (docs/telescope.md §15.4).
 *
 * Out of the box nothing calls `TelescopeJobRunner.run()` or
 * `TelescopeSchedulerService.register()`, so both pages would stay empty.
 * This service registers one demo schedule that fires a demo job on every
 * tick, so a local dev immediately sees:
 *
 * - `/telescope/schedules` — a "telescope-demo" card flipping pending →
 *   succeeded (or failed) with duration + next run time, and
 * - `/telescope/jobs` — a "demo-job" entry per fire with timestamps.
 *
 * This is intentionally a SEPARATE injectable that self-guards on
 * `options.enabled` — when Telescope is disabled (production fail-closed),
 * `onModuleInit` returns without registering anything, so the demo schedule
 * and seeded deliveries cannot leak into production.
 */
@Injectable()
export class TelescopeDemoService implements OnModuleInit {
	private readonly logger: Logger = new Logger(TelescopeDemoService.name);

	public constructor(
		@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions,
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
		private readonly jobRunner: TelescopeJobRunner,
		private readonly scheduler: TelescopeSchedulerService,
	) {}

	public onModuleInit(): void {
		// Fail-closed: demo wiring only ever runs while Telescope is enabled.
		if (!this.options.enabled) {
			return;
		}
		this.scheduler.register("telescope-demo", "*/1 * * * *", async (): Promise<void> => {
			await this.runDemoJob();
		});
		this.seedDemoDeliveries();
		this.logger.log('Demo schedule registered: "telescope-demo" every minute', TelescopeDemoService.name);
	}

	/**
	 * Seed a few webhook-delivery rows so the deliveries strip (overview +
	 * status page) has data out of the box instead of the empty state. The
	 * timestamps are intentionally recent so they show up in the default view.
	 */
	private seedDemoDeliveries(): void {
		const now: number = Date.now();
		const seed: readonly {
			readonly status: "success" | "failed";
			readonly statusCode: number | null;
			readonly durationMs: number;
			readonly attempt: number;
			readonly error: string | null;
			readonly minutesAgo: number;
		}[] = [
			// Pushed with `unshift`, so list them OLDEST-first here — the newest
			// (minutesAgo 2) ends up at the head of the deliveries list.
			{ status: "failed", statusCode: 500, durationMs: 94, attempt: 1, error: "POST https://example.invalid/hook — 500 Internal Server Error", minutesAgo: 31 },
			{ status: "success", statusCode: 200, durationMs: 211, attempt: 0, error: null, minutesAgo: 14 },
			{ status: "success", statusCode: 200, durationMs: 182, attempt: 0, error: null, minutesAgo: 2 },
		];
		for (const row of seed) {
			this.store.pushWebhookDelivery({
				id: `demo-wh-${String(row.minutesAgo)}`,
				alertId: "demo-alert",
				status: row.status,
				statusCode: row.statusCode,
				durationMs: row.durationMs,
				attempt: row.attempt,
				error: row.error,
				createdAt: new Date(now - row.minutesAgo * 60_000).toISOString(),
			});
		}
		this.logger.log(`Seeded ${String(seed.length)} demo webhook delivery rows`, TelescopeDemoService.name);
	}

	/** One demo job: a tiny fake "report" task so the Jobs page has data. */
	private async runDemoJob(): Promise<void> {
		await this.jobRunner.run(
			"demo-job",
			async (): Promise<{ readonly records: number }> => {
				// Simulate a small unit of background work.
				await new Promise<void>((resolve): void => {
					setTimeout(resolve, 40);
				});
				const records: number = Math.floor(Math.random() * 25) + 5;
				return { records };
			},
			{ source: "telescope-demo-schedule" },
		);
		this.logger.log("Demo job fired", TelescopeDemoService.name);
	}

	/** Referenced so the store stays reachable from this class's DI graph. */
	public storeMode(): string {
		return this.store.mode;
	}
}
