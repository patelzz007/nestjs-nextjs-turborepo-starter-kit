import type { Logger } from "@nestjs/common";

import { DATABASE_CONNECT_TIMEOUT_MS } from "./database-pool.constants";

/** One Prisma log subscription (`$on` events only: nothing is printed by Prisma itself). */
export interface PrismaLogSubscription {
	readonly emit: "event";
	readonly level: "query" | "info" | "warn" | "error";
}

/**
 * The log events both API Prisma clients subscribe to. Query events always (the performance
 * interceptor and debug logging read them; Prisma 7 driver adapters may not emit them, which degrades
 * to no query rows); info / warn / error only at debug log level.
 */
export function prismaLogSubscriptions(isDebugLogging: boolean): PrismaLogSubscription[] {
	return isDebugLogging
		? [
				{ emit: "event", level: "query" },
				{ emit: "event", level: "info" },
				{ emit: "event", level: "warn" },
				{ emit: "event", level: "error" },
			]
		: [{ emit: "event", level: "query" }];
}

/** What both API Prisma clients set on every interactive transaction (`$transaction(async (tx) => …)`). */
export interface PrismaTransactionDefaults {
	/** How long a transaction may wait to start, which is mostly the pool checkout. */
	readonly maxWait: number;
}

/**
 * A transaction waits to start as long as the pool's own checkout may ({@link DATABASE_CONNECT_TIMEOUT_MS}).
 * Left unset, Prisma's `maxWait` is 2 s: it gave up before the pool's 5 s checkout bound, so a burst the
 * pool would have served became a 500 ("Unable to start a transaction in the given time"). One bound, set once.
 */
export const PRISMA_TRANSACTION_DEFAULTS: PrismaTransactionDefaults = { maxWait: DATABASE_CONNECT_TIMEOUT_MS };

/** How one API replica splits its `DB_POOL_MAX` connections between its two pools. */
export interface DatabasePoolBudget {
	/** The request pool (`PrismaService`): every request and job. */
	readonly request: number;
	/** The system pool (`SystemPrismaService`): the authorization audit kernel only. */
	readonly system: number;
}

/** `DB_POOL_MAX` from which the system pool gets its second connection. */
const SYSTEM_POOL_SECOND_CONNECTION_FROM = 10;
/** The system pool below that budget: one connection serves its single low-volume consumer. */
const SYSTEM_POOL_CONNECTIONS_SMALL = 1;
/** The system pool from that budget up: a second connection, so one slow audit write never blocks the next. */
const SYSTEM_POOL_CONNECTIONS_LARGE = 2;

/**
 * `DB_POOL_MAX` is the replica's whole connection budget, shared by both pools, so `replicas ×
 * DB_POOL_MAX` is what the database must allow (the two pools used to be sized independently, each
 * `DB_POOL_MAX`). The system pool serves one low-volume consumer: one connection, two from a budget of
 * {@link SYSTEM_POOL_SECOND_CONNECTION_FROM}; the request pool gets the rest.
 */
export function databasePoolBudget(total: number): DatabasePoolBudget {
	const system = total >= SYSTEM_POOL_SECOND_CONNECTION_FROM ? SYSTEM_POOL_CONNECTIONS_LARGE : SYSTEM_POOL_CONNECTIONS_SMALL;
	return { request: total - system, system };
}

/** What closing a Prisma client needs: the client and the pool its driver adapter checks out from. */
export interface ClosablePrismaConnection {
	$disconnect(): Promise<void>;
}

/** The two log lines around closing one client (each pool names itself). */
export interface CloseMessages {
	readonly closing: string;
	readonly closed: string;
}

/** Disconnects Prisma, then ends its pool (in that order: Prisma releases its checkouts first). */
export async function closePrismaConnections(client: ClosablePrismaConnection, pool: { end(): Promise<void> }, logger: Logger, messages: CloseMessages): Promise<void> {
	logger.log(messages.closing);
	await client.$disconnect();
	await pool.end();
	logger.log(messages.closed);
}
