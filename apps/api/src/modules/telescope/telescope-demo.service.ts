import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { TelescopeJobRunner } from "./telescope-job-runner.js";
import { TELESCOPE_STORE } from "./telescope.options.js";
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
 * This is intentionally a SEPARATE injectable that only exists when Telescope
 * is enabled (it is registered alongside the other feature services in
 * `TelescopeModule.register()`), so it cannot affect production behavior:
 * `NODE_ENV=production` fail-closes Telescope entirely.
 */
@Injectable()
// eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- Registered in TelescopeModule.register()'s dynamic providers; the typed plugin only scans static @Module decorators.
export class TelescopeDemoService implements OnModuleInit {
	private readonly logger: Logger = new Logger(TelescopeDemoService.name);

	public constructor(
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
		private readonly jobRunner: TelescopeJobRunner,
		private readonly scheduler: TelescopeSchedulerService,
	) {}

	public onModuleInit(): void {
		this.scheduler.register("telescope-demo", "*/1 * * * *", async (): Promise<void> => {
			await this.runDemoJob();
		});
		this.logger.log('Demo schedule registered: "telescope-demo" every minute', TelescopeDemoService.name);
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
