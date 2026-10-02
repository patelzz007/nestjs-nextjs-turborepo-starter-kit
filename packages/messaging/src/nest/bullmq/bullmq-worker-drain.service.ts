import { WorkerHost } from "@nestjs/bullmq";

/** What the drain needs from one processor: its worker's `close`. */
type ClosableWorkerHost = Pick<WorkerHost, "worker">;

/**
 * Where the drain finds the application's providers — Nest's `DiscoveryService`
 * satisfies it (narrowed so tests need no Nest container).
 */
export interface ProviderSource {
	getProviders(): readonly { readonly instance: object | null | undefined }[];
}

/**
 * Stops every BullMQ worker in the application and waits for the jobs they are
 * running to finish.
 *
 * Call it at the START of a graceful shutdown, before `app.close()`. Nest's own
 * shutdown runs every `onModuleDestroy` hook first — where Prisma ends its pool
 * and the Kafka / Redis clients disconnect — and `@nestjs/bullmq` closes its
 * workers only in the LAST phase (`onApplicationShutdown`). Without this step a
 * job still running at shutdown fails with "Cannot use a pool after calling end
 * on the pool" (and its retry is wasted on a dead process).
 *
 * `Worker.close()` is idempotent, so `@nestjs/bullmq` closing the same workers
 * again later is a no-op. With BullMQ disabled there are no processors and
 * this resolves immediately. Registered with a factory over Nest's
 * `DiscoveryService` (`bullmq-infrastructure.module.ts`).
 */
export class BullMqWorkerDrainService {
	public constructor(private readonly discovery: ProviderSource) {}

	/** Close every worker (no new jobs; running jobs finish). Returns how many were closed. */
	public async drain(): Promise<number> {
		const hosts: ClosableWorkerHost[] = this.discovery
			.getProviders()
			.map((wrapper): object | null | undefined => wrapper.instance)
			.filter((instance): instance is WorkerHost => instance instanceof WorkerHost);
		await Promise.all(hosts.map(async (host: ClosableWorkerHost): Promise<void> => host.worker.close()));
		return hosts.length;
	}
}
