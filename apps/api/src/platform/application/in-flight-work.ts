/**
 * The runs a timer has started and that have not finished yet: an interval sweep, a retry, a buffer flush.
 *
 * `setInterval` fires and forgets, so nothing would wait for a run still working when the application shuts
 * down, and the connections it uses close under it (ADR 095). A scheduler routes each run through
 * {@link track} and, once its timers are stopped, awaits {@link settled} in `beforeApplicationShutdown`.
 */
export class InFlightWork {
	private readonly running = new Set<Promise<void>>();

	/** How many runs are still working. */
	public get size(): number {
		return this.running.size;
	}

	/** Starts `work` and remembers it until it settles. The caller gets the run's own result or error. */
	public track<T>(work: () => Promise<T>): Promise<T> {
		const run: Promise<T> = work();
		const settled: Promise<void> = run.then(
			(): undefined => undefined,
			(): undefined => undefined,
		);
		const tracked: Promise<void> = settled.then((): void => {
			this.running.delete(tracked);
		});
		this.running.add(tracked);
		return run;
	}

	/** Resolves once every run has settled, including runs started while it waited. Never rejects. */
	public async settled(): Promise<void> {
		while (this.running.size > 0) {
			await Promise.all(this.running);
		}
	}
}
