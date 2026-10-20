import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";
import { Pool, type PoolConfig } from "pg";

import { TypedConfigService } from "../config/typed-config.service";
import { DATABASE_APPLICATION_NAME, DATABASE_CONNECT_TIMEOUT_MS } from "./database-pool.constants";
import { closePrismaConnections, databasePoolBudget, prismaLogSubscriptions } from "./prisma-client-setup";

/**
 * Pool settings for the system client: its share of the replica's `DB_POOL_MAX`
 * budget (see `databasePoolBudget`; the request pool takes the rest, so one
 * replica never holds more than `DB_POOL_MAX` connections), the validated idle
 * timeout and exit-on-idle, plus a bounded connect timeout, so a dead database
 * fails a system operation fast instead of hanging it.
 */
export function buildSystemPoolConfig(config: TypedConfigService): PoolConfig {
	return {
		connectionString: config.database.url,
		max: databasePoolBudget(config.database.poolMax).system,
		idleTimeoutMillis: config.database.idleTimeoutMs,
		allowExitOnIdle: config.database.allowExitOnIdle,
		connectionTimeoutMillis: DATABASE_CONNECT_TIMEOUT_MS,
		application_name: DATABASE_APPLICATION_NAME.system,
	};
}

/**
 * Dedicated Prisma client for system-level operations (migrations, initialization, etc.).
 *
 * Unlike PrismaService, this client:
 * - Uses a standard pg.Pool (NOT the RlsPool, so no automatic SET ROLE app_runtime)
 * - Connects directly as the DATABASE_URL superuser
 * - Should ONLY be used for system operations, never for user requests
 *
 * Use cases:
 * - Module initialization (onModuleInit hooks)
 * - Permission/role migrations
 * - System configuration sync
 * - Database seeding
 *
 * Security note: This client bypasses RLS entirely. Only inject it into
 * services that genuinely need system-level access.
 */
@Injectable()
export class SystemPrismaService extends PrismaClient<Prisma.PrismaClientOptions, Prisma.LogLevel> implements OnModuleDestroy {
	private readonly logger: Logger = new Logger(SystemPrismaService.name);
	private readonly pool: Pool;

	public constructor(config: TypedConfigService) {
		const pool = new Pool(buildSystemPoolConfig(config));
		const isDebug: boolean = config.isDebugLogging;
		super({ adapter: new PrismaPg(pool), log: prismaLogSubscriptions(isDebug) });
		this.pool = pool;

		this.$on("error", (event: Prisma.LogEvent): void => {
			this.logger.error(`Prisma error: ${event.message} (target: ${event.target})`);
		});

		if (isDebug) {
			this.$on("query", (event: Prisma.QueryEvent): void => {
				this.logger.debug(`Query: ${event.query} (${String(event.duration)}ms)`);
			});
		}
	}

	public async onModuleDestroy(): Promise<void> {
		await closePrismaConnections(this, this.pool, this.logger, { closing: "Closing system database connection…", closed: "System database connection closed" });
	}
}
