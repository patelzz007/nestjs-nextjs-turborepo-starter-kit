import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { DependencyUnavailableError } from "../common/errors/app-error";
import { TypedConfigService } from "../config/typed-config.service";
import { RlsPool } from "./rls-pool";

/** Result of one connection attempt — a value, never a rejection. */
type ConnectionOutcome = { readonly connected: true } | { readonly connected: false; readonly error: Error };

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(PrismaService.name);
	private readonly pool: RlsPool;

	/**
	 * The latest connection attempt. It never rejects — it resolves to its
	 * outcome — so a failed BACKGROUND attempt can never become an unhandled
	 * rejection; {@link ensureConnected} turns a failure into a thrown 503.
	 */
	private connectionAttempt: Promise<ConnectionOutcome> | undefined;

	public constructor(config: TypedConfigService) {
		const pool = new RlsPool({
			connectionString: config.databaseUrl,
			max: config.databasePoolMax,
			idleTimeoutMillis: config.databaseIdleTimeoutMs,
			allowExitOnIdle: config.databaseAllowExitOnIdle,
		});
		const adapter = new PrismaPg(pool);

		// Configure logging based on LOG_LEVEL (validated config)
		const isDebug: boolean = config.isDebugLogging;

		// Query events are available via Prisma's $on method.
		// NOTE: Prisma 7 driver adapters may not emit these — log capture degrades
		// gracefully (no query rows) rather than crashing.
		type LogConfig = { readonly emit: "event"; readonly level: "query" | "info" | "warn" | "error" };
		const logConfig: LogConfig[] = isDebug
			? [
					{ emit: "event", level: "query" },
					{ emit: "event", level: "info" },
					{ emit: "event", level: "warn" },
					{ emit: "event", level: "error" },
				]
			: [{ emit: "event", level: "query" }];

		super({ adapter, log: logConfig });
		this.pool = pool;
	}

	/**
	 * Starts connecting in the background so `NestFactory.create()` returns
	 * fast. A database that is down at boot does not crash the process: the
	 * failure is logged, `/health/ready` reports the database probe `down`
	 * (503) until it answers, and {@link ensureConnected} retries and throws.
	 */
	public onModuleInit(): void {
		this.connectionAttempt = this.attemptConnection();
	}

	/**
	 * Waits for a VERIFIED database connection. If the latest attempt failed it
	 * retries once (concurrent callers share that retry) and, when the database
	 * still does not answer, throws a 503 {@link DependencyUnavailableError} —
	 * callers fail loudly instead of running against a dead connection.
	 */
	public async ensureConnected(): Promise<void> {
		const awaited: Promise<ConnectionOutcome> = this.connectionAttempt ?? this.startConnectionAttempt();
		const outcome: ConnectionOutcome = await awaited;
		if (outcome.connected) {
			return;
		}
		// Single-flight retry: join one another caller already started, else start it.
		const current: Promise<ConnectionOutcome> | undefined = this.connectionAttempt;
		const retry: Promise<ConnectionOutcome> = current !== undefined && current !== awaited ? current : this.startConnectionAttempt();
		const retried: ConnectionOutcome = await retry;
		if (!retried.connected) {
			throw new DependencyUnavailableError({ message: "The database is unavailable.", cause: retried.error });
		}
	}

	private startConnectionAttempt(): Promise<ConnectionOutcome> {
		const attempt: Promise<ConnectionOutcome> = this.attemptConnection();
		this.connectionAttempt = attempt;
		return attempt;
	}

	/** `$connect()` alone does not touch the pool with a driver adapter, so a `SELECT 1` proves the database answers. */
	private async attemptConnection(): Promise<ConnectionOutcome> {
		try {
			await this.$connect();
			await this.$queryRaw`SELECT 1`;
			this.logger.log("Database connected");
			return { connected: true };
		} catch (error) {
			const failure: Error = error instanceof Error ? error : new Error("Database connection failed.");
			this.logger.error(`Database connection failed: ${failure.message}`);
			return { connected: false, error: failure };
		}
	}

	public async onModuleDestroy(): Promise<void> {
		this.logger.log("Closing database connections…");
		await this.$disconnect();
		await this.pool.end();
		this.logger.log("Database connections closed");
	}
}
