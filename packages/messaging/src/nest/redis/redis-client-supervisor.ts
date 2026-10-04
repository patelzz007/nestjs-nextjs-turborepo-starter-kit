/** The slice of an ioredis client the supervisor needs (an ioredis `Redis` satisfies it). */
export interface SupervisedRedisClient {
	readonly status: string;
	on(event: "error", listener: (error: Error) => void): this;
	quit(): Promise<string>;
}

/** Where the supervisor reports (a Nest `Logger` satisfies it). */
export interface RedisSupervisorLog {
	log(message: string): void;
	debug(message: string): void;
	error(message: string): void;
}

/** ioredis status of a client that has fully closed. */
const ENDED_STATUS = "end";

/**
 * Owns ONE shared Redis client's lifecycle: the only place it is closed, and
 * the only `error` listener it needs.
 *
 * - While running, an `error` (connection lost, auth failure, …) is a real
 *   problem and is logged at ERROR. Without a listener ioredis would print
 *   "Unhandled error event" to stderr instead.
 * - After {@link close} started, errors are the expected tail of an
 *   intentional shutdown (commands rejected with "Connection is closed",
 *   socket teardown) and are logged at debug only.
 * - {@link close} is idempotent: concurrent and repeated calls share one
 *   QUIT, so a second closer can never race the first into a
 *   "Connection is closed" rejection.
 */
export class RedisClientSupervisor {
	private closing: Promise<void> | null = null;

	public constructor(
		private readonly client: SupervisedRedisClient,
		private readonly label: string,
		private readonly logger: RedisSupervisorLog,
	) {
		client.on("error", (error: Error): void => {
			if (this.closing !== null) {
				this.logger.debug(`Redis ${label}: ${error.message} (expected during shutdown)`);
				return;
			}
			this.logger.error(`Redis ${label} error: ${error.message}`);
		});
	}

	/** Whether {@link close} has been called. */
	public get isClosing(): boolean {
		return this.closing !== null;
	}

	/** QUIT the client once (pending replies are flushed first); later calls await the same close. */
	public close(): Promise<void> {
		this.closing ??= this.quit();
		return this.closing;
	}

	private async quit(): Promise<void> {
		if (this.client.status === ENDED_STATUS) {
			return;
		}
		try {
			await this.client.quit();
			this.logger.log(`Redis ${this.label} disconnected`);
		} catch (error) {
			// QUIT on a connection that is already gone: nothing left to close.
			this.logger.debug(`Redis ${this.label} was already closed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
