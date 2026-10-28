// ============================================
// infrastructure/probes/dependency-probes.ts — the six dependency probes (Strategy)
// ============================================
// Each probe times its own check and never throws: a failure is `up: false` with a reason. Every
// value read from a third party (PostgreSQL catalogs, Redis INFO, HTTP answers) is validated or
// parsed defensively here before it reaches the contract.

import { connect as netConnect } from "node:net";
import { connect as tlsConnect, type PeerCertificate } from "node:tls";

import type { Prisma } from "@prisma/client";
import { OPS_LARGEST_TABLE_COUNT, type OpsDependency, type OpsDependencyStats } from "@workspace/shared";
import type { Redis } from "ioredis";
import { z } from "zod";

import type { DependencyProbe, DependencyProbeResult } from "../../application/ports/dependency-probe.port";

/** How long one check may take. */
export const PROBE_TIMEOUT_MS = 3_000;
/** A query running longer than this counts as slow. */
const SLOW_QUERY_SECONDS = 1;
const MS_PER_DAY = 86_400_000;
const HUNDRED = 100;
const HTTPS_PORT = 443;

/** Runs `check` and times it; any failure (or the timeout) is `up: false`. */
async function timed(check: () => Promise<OpsDependencyStats>, now: () => number = Date.now): Promise<DependencyProbeResult> {
	const started: number = now();
	let timer: NodeJS.Timeout | undefined;
	try {
		const stats: OpsDependencyStats = await Promise.race([
			check(),
			new Promise<OpsDependencyStats>((_resolve, reject): void => {
				timer = setTimeout((): void => {
					reject(new Error(`no answer within ${String(PROBE_TIMEOUT_MS)} ms`));
				}, PROBE_TIMEOUT_MS);
			}),
		]);
		return { configured: true, up: true, latencyMs: now() - started, stats };
	} catch (error) {
		return { configured: true, up: false, latencyMs: null, error: error instanceof Error ? error.message : String(error) };
	} finally {
		clearTimeout(timer);
	}
}

// ── PostgreSQL ──────────────────────────────────────────────────────────────

/** A catalog row as the driver returns it, before zod reads it. */
type RawRow = Readonly<Record<string, string | number | bigint | null>>;

const PostgresRowSchema = z.object({
	connectionsUsed: z.coerce.number(),
	connectionsMax: z.coerce.number(),
	cacheHitPercent: z.coerce.number().nullable(),
	sizeBytes: z.coerce.number(),
	longestQuerySeconds: z.coerce.number().nullable(),
	slowQueries: z.coerce.number(),
	deadlocks: z.coerce.number(),
});
const TableRowSchema = z.object({ name: z.string(), bytes: z.coerce.number() });

/** The catalog queries, on a transaction the caller opens (they read no application table). */
export type PostgresStatsReader = (work: (db: Pick<Prisma.TransactionClient, "$queryRaw">) => Promise<OpsDependencyStats>) => Promise<OpsDependencyStats>;

export class PostgresProbe implements DependencyProbe {
	public readonly dependency: OpsDependency = "POSTGRES";

	/** `sizeYesterday` reads the size the history recorded a day ago (for the growth rate). */
	public constructor(
		private readonly run: PostgresStatsReader,
		private readonly sizeYesterday: () => Promise<number | null>,
	) {}

	public probe(): Promise<DependencyProbeResult> {
		return timed(() =>
			this.run(async (db) => {
				const [row] = await db.$queryRaw<RawRow[]>`
					SELECT
						(SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS "connectionsUsed",
						current_setting('max_connections')::int AS "connectionsMax",
						(SELECT sum(blks_hit) * ${HUNDRED}::numeric / NULLIF(sum(blks_hit) + sum(blks_read), 0) FROM pg_stat_database WHERE datname = current_database()) AS "cacheHitPercent",
						pg_database_size(current_database()) AS "sizeBytes",
						(SELECT max(extract(epoch FROM now() - query_start)) FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid() AND datname = current_database()) AS "longestQuerySeconds",
						(SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid() AND datname = current_database() AND now() - query_start > make_interval(secs => ${SLOW_QUERY_SECONDS})) AS "slowQueries",
						(SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()) AS "deadlocks"`;
				const tables = await db.$queryRaw<RawRow[]>`
					SELECT relname AS name, pg_total_relation_size(relid) AS bytes
					FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT ${OPS_LARGEST_TABLE_COUNT}`;
				const stats = PostgresRowSchema.parse(row);
				const yesterday: number | null = await this.sizeYesterday();
				return {
					dependency: "POSTGRES",
					...stats,
					cacheHitPercent: stats.cacheHitPercent === null ? null : Math.min(HUNDRED, stats.cacheHitPercent),
					growthBytesPerDay: yesterday === null ? null : stats.sizeBytes - yesterday,
					largestTables: z.array(TableRowSchema).parse(tables),
				};
			}),
		);
	}
}

/** Bytes per day between two sizes `elapsedMs` apart. */
export function growthPerDay(olderBytes: number, newerBytes: number, elapsedMs: number): number {
	return elapsedMs <= 0 ? 0 : ((newerBytes - olderBytes) / elapsedMs) * MS_PER_DAY;
}

// ── Redis ───────────────────────────────────────────────────────────────────

/** `key:value` lines of Redis `INFO`. */
export function parseRedisInfo(info: string): ReadonlyMap<string, string> {
	return new Map(
		info.split(/\r?\n/).flatMap((line): [string, string][] => {
			const match = /^(?<key>[a-z_0-9]+):(?<value>.*)$/.exec(line);
			return match?.groups?.key === undefined || match.groups.value === undefined ? [] : [[match.groups.key, match.groups.value.trim()]];
		}),
	);
}

function infoNumber(info: ReadonlyMap<string, string>, key: string): number | null {
	const value: string | undefined = info.get(key);
	if (value === undefined) {
		return null;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export class RedisProbe implements DependencyProbe {
	public readonly dependency: OpsDependency = "REDIS";

	public constructor(private readonly redis: Pick<Redis, "info"> | null) {}

	public probe(): Promise<DependencyProbeResult> {
		const { redis } = this;
		if (redis === null) {
			return Promise.resolve({ configured: false });
		}
		return timed(async () => {
			const info = parseRedisInfo(await redis.info());
			const hits: number = infoNumber(info, "keyspace_hits") ?? 0;
			const misses: number = infoNumber(info, "keyspace_misses") ?? 0;
			const maxMemory: number | null = infoNumber(info, "maxmemory");
			return {
				dependency: "REDIS",
				usedMemoryBytes: infoNumber(info, "used_memory") ?? 0,
				maxMemoryBytes: maxMemory === null || maxMemory === 0 ? null : maxMemory,
				hitRatePercent: hits + misses === 0 ? null : (hits / (hits + misses)) * HUNDRED,
				evictedKeys: infoNumber(info, "evicted_keys") ?? 0,
				opsPerSecond: infoNumber(info, "instantaneous_ops_per_sec") ?? 0,
				connectedClients: infoNumber(info, "connected_clients") ?? 0,
			};
		});
	}
}

// ── Queues ──────────────────────────────────────────────────────────────────

/** What the probe reads of a BullMQ queue. */
export interface CountableQueue {
	readonly name: string;
	getJobCounts(...types: string[]): Promise<Record<string, number>>;
}

export class QueuesProbe implements DependencyProbe {
	public readonly dependency: OpsDependency = "QUEUES";

	public constructor(private readonly queues: readonly CountableQueue[] | null) {}

	public probe(): Promise<DependencyProbeResult> {
		const { queues } = this;
		if (queues === null) {
			return Promise.resolve({ configured: false });
		}
		return timed(async () => ({
			dependency: "QUEUES",
			queues: await Promise.all(
				queues.map(async (queue) => {
					const counts: Record<string, number> = await queue.getJobCounts("waiting", "active", "delayed", "failed");
					return { name: queue.name, waiting: counts.waiting ?? 0, active: counts.active ?? 0, delayed: counts.delayed ?? 0, failed: counts.failed ?? 0 };
				}),
			),
		}));
	}
}

// ── Kafka ───────────────────────────────────────────────────────────────────

export class KafkaProbe implements DependencyProbe {
	public readonly dependency: OpsDependency = "KAFKA";

	public constructor(
		private readonly producer: { isEnabled(): boolean; ping(): Promise<{ readonly reachable: true } | { readonly reachable: false; readonly reason: string }> },
		private readonly brokers: number,
	) {}

	public probe(): Promise<DependencyProbeResult> {
		if (!this.producer.isEnabled()) {
			return Promise.resolve({ configured: false });
		}
		return timed(async () => {
			const result = await this.producer.ping();
			if (!result.reachable) {
				throw new Error(result.reason);
			}
			// Consumer lag needs the consumer group's offsets from Kafka's admin API: not measured yet.
			return { dependency: "KAFKA", brokers: this.brokers, consumerLag: null };
		});
	}
}

// ── RabbitMQ ────────────────────────────────────────────────────────────────

/** Opens (and closes) a TCP connection to `host:port`. */
export function tcpReachable(host: string, port: number): Promise<void> {
	return new Promise((resolve, reject): void => {
		const socket = netConnect({ host, port, timeout: PROBE_TIMEOUT_MS });
		socket.once("connect", (): void => {
			socket.end();
			resolve();
		});
		socket.once("timeout", (): void => {
			socket.destroy();
			reject(new Error(`${host}:${String(port)} did not answer`));
		});
		socket.once("error", (error: Error): void => {
			reject(error);
		});
	});
}

const AMQP_PORT = 5672;

/** RabbitMQ is wired as a placeholder in this kit (no client), so the probe checks that the broker accepts connections. */
export class RabbitMqProbe implements DependencyProbe {
	public readonly dependency: OpsDependency = "RABBITMQ";

	public constructor(
		private readonly url: string | undefined,
		private readonly reach: (host: string, port: number) => Promise<void> = tcpReachable,
	) {}

	public probe(): Promise<DependencyProbeResult> {
		const { url } = this;
		if (url === undefined) {
			return Promise.resolve({ configured: false });
		}
		return timed(async () => {
			const parsed = new URL(url);
			await this.reach(parsed.hostname, parsed.port === "" ? AMQP_PORT : Number(parsed.port));
			return { dependency: "RABBITMQ", connected: true };
		});
	}
}

// ── Public endpoints ────────────────────────────────────────────────────────

/** Days until an `https` endpoint's certificate expires, or `null` for plain http. */
export function tlsDaysLeft(url: URL, now: number = Date.now()): Promise<number | null> {
	if (url.protocol !== "https:") {
		return Promise.resolve(null);
	}
	return new Promise((resolve, reject): void => {
		const socket = tlsConnect({ host: url.hostname, port: url.port === "" ? HTTPS_PORT : Number(url.port), servername: url.hostname, timeout: PROBE_TIMEOUT_MS }, (): void => {
			const certificate: PeerCertificate = socket.getPeerCertificate();
			socket.end();
			const expiresAt: number = Date.parse(certificate.valid_to);
			resolve(Number.isNaN(expiresAt) ? null : Math.floor((expiresAt - now) / MS_PER_DAY));
		});
		socket.once("timeout", (): void => {
			socket.destroy();
			reject(new Error("TLS handshake timed out"));
		});
		socket.once("error", reject);
	});
}

/** The public addresses to check: the API's liveness probe and each app's home page. */
export class EndpointsProbe implements DependencyProbe {
	public readonly dependency: OpsDependency = "ENDPOINTS";

	public constructor(
		private readonly urls: readonly string[],
		private readonly fetchImpl: (
			url: string,
			init: { readonly method: string; readonly signal: AbortSignal; readonly redirect: "manual" },
		) => Promise<Pick<Response, "status">> = fetch,
		private readonly certificateDays: (url: URL) => Promise<number | null> = tlsDaysLeft,
	) {}

	public probe(): Promise<DependencyProbeResult> {
		return timed(async () => ({
			dependency: "ENDPOINTS",
			endpoints: await Promise.all(
				this.urls.map(async (url) => {
					const started: number = Date.now();
					try {
						const response = await this.fetchImpl(url, { method: "GET", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), redirect: "manual" });
						const latencyMs: number = Date.now() - started;
						const tls: number | null = await this.certificateDays(new URL(url)).catch(() => null);
						const serverError = 500;
						return { url, up: response.status < serverError, status: response.status, latencyMs, tlsDaysLeft: tls };
					} catch {
						return { url, up: false, status: null, latencyMs: null, tlsDaysLeft: null };
					}
				}),
			),
		}));
	}
}
