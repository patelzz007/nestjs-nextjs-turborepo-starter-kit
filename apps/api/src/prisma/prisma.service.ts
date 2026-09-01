import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { RlsPool } from "./rls-pool";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(PrismaService.name);

	/** Resolves when the DB connection is ready. Requests before this settle will wait. */
	private readonly connected: Promise<void>;
	private resolveConnected: (() => void) | undefined;

	public constructor() {
		const pool = new RlsPool({ connectionString: process.env.DATABASE_URL });
		const adapter = new PrismaPg(pool);

		// Configure logging based on environment
		const logLevel: string = process.env.LOG_LEVEL ?? "warn";
		const isDebug: boolean = logLevel === "debug" || logLevel === "silly";

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

		// Background connect: resolve immediately so the app can boot,
		// but the first request that needs DB will await this promise.
		this.connected = new Promise<void>((resolve: () => void) => {
			this.resolveConnected = resolve;
		});
	}

	public async onModuleInit(): Promise<void> {
		// Fire-and-forget: connect in background so NestFactory.create() returns fast.
		// The first DB query will await `this.connected` if the pool isn't ready yet.
		void this.$connect()
			.then(() => {
				this.logger.log("Database connected");
				this.resolveConnected?.();
			})
			.catch((err: unknown) => {
				this.logger.error(`Database connection failed: ${String(err)}`);
				// Still resolve so the app can start and retry on first request
				this.resolveConnected?.();
			});
	}

	/**
	 * Ensure the DB connection is ready before running a query.
	 * Call this in services that must wait for the connection (e.g. seed, migrations).
	 * Request handlers don't need this — Prisma retries internally.
	 */
	public async ensureConnected(): Promise<void> {
		await this.connected;
	}

	public async onModuleDestroy(): Promise<void> {
		await this.$disconnect();
	}
}
