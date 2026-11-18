/** A Kafka call that did not settle within the time it was given. */
export class KafkaDeadlineExceededError extends Error {
	public constructor(
		public readonly operation: string,
		public readonly timeoutMs: number,
	) {
		super(`${operation} did not complete within ${String(timeoutMs)} ms`);
		this.name = "KafkaDeadlineExceededError";
	}
}

/**
 * Settles with `work`, or rejects with {@link KafkaDeadlineExceededError} once
 * `timeoutMs` passes first. The client's own request timeout applies per
 * attempt and multiplies with its retries; this bounds the whole call. The
 * timer never outlives the call, and never keeps the process alive.
 */
export function withKafkaDeadline<T>(work: Promise<T>, operation: string, timeoutMs: number): Promise<T> {
	return new Promise<T>((resolve, reject): void => {
		const timer = setTimeout((): void => {
			reject(new KafkaDeadlineExceededError(operation, timeoutMs));
		}, timeoutMs);
		timer.unref();
		work
			.then((value: T): void => {
				clearTimeout(timer);
				resolve(value);
			})
			.catch((error: unknown): void => {
				clearTimeout(timer);
				reject(error instanceof Error ? error : new Error(String(error)));
			});
	});
}
